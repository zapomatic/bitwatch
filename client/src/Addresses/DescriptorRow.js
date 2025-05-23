import React, { useState, useEffect } from "react";
import {
  TableRow,
  TableCell,
  Box,
  IconButton,
  Typography,
  Collapse,
  Tooltip,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import IconButtonStyled from "../components/IconButtonStyled";
import RefreshIcon from "@mui/icons-material/Refresh";
import socketIO from "../io";
import AddressTable from "./AddressTable";
import { ADDRESS_DISPLAY_LENGTH } from "../config";
import BalanceCell from "./BalanceCell";

const calculateDescriptorTotals = (descriptor) => {
  const totals = {
    chain_in: 0,
    chain_out: 0,
    mempool_in: 0,
    mempool_out: 0,
    expect_chain_in: 0,
    expect_chain_out: 0,
    expect_mempool_in: 0,
    expect_mempool_out: 0,
    hasError: false,
    hasPending: false,
  };

  (descriptor.addresses || []).forEach((address) => {
    if (address.actual) {
      totals.chain_in += parseFloat(address.actual.chain_in || 0);
      totals.chain_out += parseFloat(address.actual.chain_out || 0);
      totals.mempool_in += parseFloat(address.actual.mempool_in || 0);
      totals.mempool_out += parseFloat(address.actual.mempool_out || 0);
    }
    if (address.expect) {
      totals.expect_chain_in += parseFloat(address.expect.chain_in || 0);
      totals.expect_chain_out += parseFloat(address.expect.chain_out || 0);
      totals.expect_mempool_in += parseFloat(address.expect.mempool_in || 0);
      totals.expect_mempool_out += parseFloat(address.expect.mempool_out || 0);
    }
    if (address.error) totals.hasError = true;
    if (!address.actual && !address.error) totals.hasPending = true;
  });

  return totals;
};

const DescriptorRow = ({
  descriptor,
  onEdit,
  onDelete,
  collection,
  displayBtc,
  setNotification,
  onEditAddress,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (descriptor.addresses?.length > 0) {
      setIsExpanded(true);
    }
  }, [descriptor.addresses?.length]);

  const [copied, setCopied] = useState(false);

  const handleExpandClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(descriptor);
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete({
      collectionName: collection.name,
      descriptorName: descriptor.name,
      message: "Delete this descriptor and all its derived addresses?",
    });
  };

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const textarea = document.createElement("textarea");
    textarea.value = descriptor.descriptor;
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

  const handleRefreshAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRefreshing(true);
    setNotification({
      open: true,
      message: `Refreshing balances for all addresses in ${descriptor.name}...`,
      severity: "info",
    });
    // Get test response from window context if it exists
    let testResponse = undefined;
    if (window.__TEST_RESPONSE__) {
      testResponse = window.__TEST_RESPONSE__;
      console.log("Using test response for descriptor refresh", testResponse);
      window.__TEST_RESPONSE_USED__ = true;
      window.__TEST_RESPONSE__ = undefined;
    }
    socketIO.emit(
      "refreshBalance",
      {
        collectionName: collection.name,
        descriptorName: descriptor.name,
        testResponse,
      },
      (response) => {
        setIsRefreshing(false);
        if (response.error) {
          setNotification({
            open: true,
            message: `Failed to refresh balances: ${response.error}`,
            severity: "error",
          });
        } else {
          setNotification({
            open: true,
            message: "All addresses queued for refresh",
            severity: "success",
          });
        }
      }
    );
  };

  const totals = calculateDescriptorTotals(descriptor);

  return (
    <>
      <TableRow
        className="crystal-table-row descriptor-row"
        sx={{ "& > *": { borderBottom: "unset" } }}
        data-testid={`${descriptor.descriptor}-row`}
      >
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={handleExpandClick}
              sx={{ mr: 1 }}
              data-testid={`${descriptor.descriptor}-expand-button`}
              aria-label={
                isExpanded
                  ? "Collapse descriptor details"
                  : "Expand descriptor details"
              }
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            <Typography variant="body2">{descriptor.name}</Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2">
              {descriptor.descriptor.slice(0, ADDRESS_DISPLAY_LENGTH)}...
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy full descriptor"}>
              <IconButtonStyled
                size="small"
                onClick={handleCopy}
                icon={<ContentCopyIcon fontSize="small" />}
                data-testid={`${descriptor.descriptor}-copy-button`}
                aria-label="Copy descriptor"
              />
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {(descriptor.addresses || []).length}
          </Typography>
        </TableCell>
        <TableCell className="crystal-table-cell">
          <Box className="crystal-flex crystal-flex-start">
            <BalanceCell
              value={totals.chain_in - totals.chain_out}
              expect={totals.expect_chain_in - totals.expect_chain_out}
              displayBtc={displayBtc}
              error={totals.hasError}
              pending={totals.hasPending}
            />
          </Box>
        </TableCell>
        <TableCell className="crystal-table-cell">
          <Box className="crystal-flex crystal-flex-start">
            <BalanceCell
              value={totals.mempool_in - totals.mempool_out}
              expect={totals.expect_mempool_in - totals.expect_mempool_out}
              displayBtc={displayBtc}
              error={totals.hasError}
              pending={totals.hasPending}
            />
          </Box>
        </TableCell>
        <TableCell>
          <Box className="crystal-flex crystal-flex-right crystal-gap-1">
            <IconButtonStyled
              onClick={handleRefreshAll}
              size="small"
              icon={<RefreshIcon fontSize="small" />}
              data-testid={`${descriptor.descriptor}-refresh-all-button`}
              aria-label="Refresh all addresses"
              disabled={isRefreshing}
            />
            <IconButtonStyled
              onClick={handleEditClick}
              size="small"
              icon={<EditIcon fontSize="small" />}
              data-testid={`${descriptor.descriptor}-edit-button`}
              aria-label="Edit descriptor"
            />
            <IconButtonStyled
              onClick={handleDeleteClick}
              size="small"
              icon={<DeleteIcon fontSize="small" />}
              data-testid={`${descriptor.descriptor}-delete-button`}
              aria-label="Delete descriptor"
            />
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse
            in={isExpanded}
            timeout="auto"
            unmountOnExit
            data-testid={`${descriptor.descriptor}-expanded`}
          >
            <Box sx={{ margin: 1 }}>
              <AddressTable
                addresses={descriptor.addresses}
                collectionName={collection.name}
                descriptorName={descriptor.name}
                displayBtc={displayBtc}
                setNotification={setNotification}
                onDelete={onDelete}
                onEditAddress={onEditAddress}
                parentKey={descriptor.descriptor}
                dataTestId={`${descriptor.descriptor}-address-list`}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default DescriptorRow;
