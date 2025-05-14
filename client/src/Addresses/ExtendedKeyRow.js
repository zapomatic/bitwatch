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
import RefreshIcon from "@mui/icons-material/Refresh";
import IconButtonStyled from "../components/IconButtonStyled";
import socketIO from "../io";
import AddressTable from "./AddressTable";
import { ADDRESS_DISPLAY_LENGTH } from "../config";
const ExtendedKeyRow = ({
  extendedKey,
  onEdit,
  onDelete,
  collection,
  displayBtc,
  setNotification,
  onEditAddress,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (extendedKey.addresses?.length > 0) {
      setIsExpanded(true);
    }
  }, [extendedKey.addresses?.length]);

  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleExpandClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit({
      ...extendedKey,
      keyIndex: collection.extendedKeys.findIndex(
        (k) => k.key === extendedKey.key
      ),
    });
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete({
      collectionName: collection.name,
      extendedKeyName: extendedKey.name,
      message: "Delete this extended key and all its derived addresses?",
    });
  };

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const textarea = document.createElement("textarea");
    textarea.value = extendedKey.key;
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

  const handleRefreshAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRefreshing(true);
    setNotification({
      open: true,
      message: `Refreshing balances for all addresses in ${extendedKey.name}...`,
      severity: "info",
    });

    // Get test response from window context if it exists
    let testResponse = undefined;
    if (window.__TEST_RESPONSE__) {
      testResponse = window.__TEST_RESPONSE__;
      delete window.__TEST_RESPONSE__; // Clear it after use
    }
    socketIO.emit(
      "refreshBalance",
      {
        collectionName: collection.name,
        extendedKeyName: extendedKey.name,
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

  return (
    <>
      <TableRow
        className="crystal-table-row address-row"
        sx={{ "& > *": { borderBottom: "unset" } }}
        data-testid={`${extendedKey.key}-row`}
        aria-label={`Extended key ${extendedKey.name}`}
      >
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={handleExpandClick}
              sx={{ mr: 1 }}
              data-testid={`${extendedKey.key}-expand-button`}
              aria-label={
                isExpanded
                  ? "Collapse extended key details"
                  : "Expand extended key details"
              }
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            <Typography variant="body2" data-testid={`${extendedKey.key}-name`}>
              {extendedKey.name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2">
              {extendedKey.key.slice(0, ADDRESS_DISPLAY_LENGTH)}...
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy full key"}>
              <IconButtonStyled
                size="small"
                onClick={handleCopy}
                icon={<ContentCopyIcon fontSize="small" />}
                data-testid={`${extendedKey.key}-copy-button`}
                aria-label="Copy extended key"
              />
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{extendedKey.derivationPath}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{extendedKey.gapLimit}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{extendedKey.skip || 0}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {extendedKey.initialAddresses || 10}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {(extendedKey.addresses || []).length}
          </Typography>
        </TableCell>
        <TableCell>
          <Box className="crystal-flex crystal-flex-right crystal-gap-1">
            <IconButtonStyled
              onClick={handleRefreshAll}
              size="small"
              icon={<RefreshIcon fontSize="small" />}
              data-testid={`${extendedKey.key}-refresh-all-button`}
              aria-label="Refresh all addresses"
              disabled={isRefreshing}
            />
            <IconButtonStyled
              onClick={handleEditClick}
              size="small"
              icon={<EditIcon fontSize="small" />}
              data-testid={`${extendedKey.key}-edit-button`}
              aria-label="Edit extended key"
            />
            <IconButtonStyled
              onClick={handleDeleteClick}
              size="small"
              icon={<DeleteIcon fontSize="small" />}
              data-testid={`${extendedKey.key}-delete-button`}
              aria-label="Delete extended key"
            />
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse
            in={isExpanded}
            timeout="auto"
            unmountOnExit
            data-testid={`${extendedKey.key}-expanded`}
          >
            <Box sx={{ margin: 1 }}>
              <AddressTable
                addresses={extendedKey.addresses || []}
                collection={collection}
                displayBtc={displayBtc}
                setNotification={setNotification}
                onDelete={onDelete}
                onEditAddress={onEditAddress}
                parentKey={extendedKey.key}
                dataTestId={`${extendedKey.key}-address-list`}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default ExtendedKeyRow;
