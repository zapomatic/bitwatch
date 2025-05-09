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
import IconButtonStyled from "../components/IconButtonStyled";
import AddressRow from "./AddressRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import socketIO from "../io";

const DescriptorInfo = ({
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
      collection: collection.name,
      descriptor: descriptor.descriptor,
      message: "Delete this descriptor and all its derived addresses?",
    });
  };

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(descriptor.descriptor);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

    // Refresh each address in sequence
    const refreshAddresses = async () => {
      for (const address of descriptor.addresses || []) {
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
        className="crystal-table-row descriptor-row"
        sx={{ "& > *": { borderBottom: "unset" } }}
        data-testid={`${descriptor.descriptor}-descriptor-row`}
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
              {descriptor.descriptor.slice(0, 15)}...
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
          <Typography variant="body2">{descriptor.derivationPath}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{descriptor.gapLimit}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{descriptor.skip}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{descriptor.initialAddresses}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{descriptor.addresses.length}</Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButtonStyled
              onClick={handleRefreshAll}
              icon={<RefreshIcon />}
              data-testid={`${descriptor.descriptor}-refresh-all-button`}
              aria-label="Refresh all addresses"
              disabled={isRefreshing}
            />
            <IconButtonStyled
              onClick={handleEditClick}
              icon={<EditIcon />}
              data-testid={`${descriptor.descriptor}-edit-button`}
              aria-label="Edit descriptor"
            />
            <IconButtonStyled
              onClick={handleDeleteClick}
              icon={<DeleteIcon />}
              data-testid={`${descriptor.descriptor}-delete-button`}
              aria-label="Delete descriptor"
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
            data-testid={`${descriptor.descriptor}-expanded`}
          >
            <Box sx={{ margin: 1 }}>
              <Table size="small" className="crystal-table address-subtable">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>On-Chain</TableCell>
                    <TableCell>Mempool</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody
                  data-testid={`${descriptor.descriptor}-address-list`}
                >
                  {descriptor.addresses.map((address) => (
                    <AddressRow
                      key={address.address}
                      address={address}
                      collection={collection}
                      displayBtc={displayBtc}
                      setNotification={setNotification}
                      parentKey={descriptor.descriptor}
                      index={address.index}
                      onDelete={onDelete}
                      onEditAddress={onEditAddress}
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

export default DescriptorInfo;
