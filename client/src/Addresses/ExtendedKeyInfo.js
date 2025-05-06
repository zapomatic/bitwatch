import React, { useState, useEffect } from "react";
import {
  TableRow,
  TableCell,
  Box,
  IconButton,
  Typography,
  Collapse,
  Table,
  TableBody,
  Tooltip,
  TableHead,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import IconButtonStyled from "../components/IconButtonStyled";
import AddressRow from "./AddressRow";
import socketIO from "../io";

const ExtendedKeyInfo = ({
  extendedKey,
  onEdit,
  onDelete,
  collection,
  displayBtc,
  setNotification,
  onEditAddress,
}) => {
  const [isExpanded, setIsExpanded] = useState(
    extendedKey.addresses?.length > 0
  );

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
    onEdit(extendedKey);
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete({
      collection: collection.name,
      extendedKey: extendedKey.key,
      message: "Delete this extended key and all its derived addresses?",
    });
  };

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(extendedKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

    // Refresh each address in sequence
    const refreshAddresses = async () => {
      for (const address of extendedKey.addresses || []) {
        await new Promise((resolve) => {
          socketIO.emit(
            "refreshBalance",
            {
              collection: collection.name,
              address: address.address,
            },
            (response) => {
              if (response.error) {
                setNotification({
                  open: true,
                  message: `Failed to refresh balance for ${address.name}: ${response.error}`,
                  severity: "error",
                });
              }
              resolve();
            }
          );
        });
      }
      setIsRefreshing(false);
      setNotification({
        open: true,
        message: "All balances refreshed successfully",
        severity: "success",
      });
    };

    refreshAddresses();
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
              {extendedKey.key.slice(0, 8)}...
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
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButtonStyled
              onClick={handleRefreshAll}
              icon={<RefreshIcon />}
              data-testid={`${extendedKey.key}-refresh-all-button`}
              aria-label="Refresh all addresses"
              disabled={isRefreshing}
            />
            <IconButtonStyled
              onClick={handleEditClick}
              icon={<EditIcon />}
              data-testid={`${extendedKey.key}-edit-button`}
              aria-label="Edit extended key"
            />
            <IconButtonStyled
              onClick={handleDeleteClick}
              icon={<DeleteIcon />}
              data-testid={`${extendedKey.key}-delete-button`}
              aria-label="Delete extended key"
            />
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Table
                size="small"
                className="crystal-table address-subtable"
                data-testid={`${extendedKey.key}-address-table`}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>On-Chain</TableCell>
                    <TableCell>Mempool</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody data-testid={`${extendedKey.key}-address-list`}>
                  {(extendedKey.addresses || []).map((address) => (
                    <AddressRow
                      key={address.address}
                      address={address}
                      collection={collection}
                      displayBtc={displayBtc}
                      setNotification={setNotification}
                      parentKey={extendedKey.key}
                      index={address.index}
                      onEditAddress={onEditAddress}
                      onDelete={onDelete}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default ExtendedKeyInfo;
