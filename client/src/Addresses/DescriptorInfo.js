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
}) => {
  const [isExpanded, setIsExpanded] = useState(
    descriptor.addresses?.length > 0
  );
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
    onDelete({ descriptor });
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
      message: `Refreshing balances for ${descriptor.name}...`,
      severity: "info",
    });

    let hasError = false;

    // Refresh all addresses in sequence
    for (const address of descriptor.addresses) {
      try {
        await new Promise((resolve, reject) => {
          socketIO.emit(
            "refreshBalance",
            {
              collection: collection.name,
              address: address.address,
            },
            (response) => {
              if (response.error) {
                hasError = true;
                reject(response.error);
              } else {
                resolve();
              }
            }
          );
        });
      } catch (error) {
        setNotification({
          open: true,
          message: `Failed to refresh balance: ${error}`,
          severity: "error",
        });
      }
    }

    setIsRefreshing(false);
    setNotification({
      open: true,
      message: hasError
        ? "Some balances failed to refresh"
        : "Balances refreshed successfully",
      severity: hasError ? "warning" : "success",
    });
  };

  return (
    <>
      <TableRow
        className="crystal-table-row descriptor-row"
        sx={{ "& > *": { borderBottom: "unset" } }}
        data-testid={`${descriptor.name}-descriptor-row`}
      >
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={handleExpandClick}
              sx={{ mr: 1 }}
              data-testid={`${descriptor.name}-expand-button`}
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
              {descriptor.descriptor.slice(0, 8)}...
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy full descriptor"}>
              <IconButtonStyled
                size="small"
                onClick={handleCopy}
                icon={<ContentCopyIcon fontSize="small" />}
                data-testid={`${descriptor.name}-copy-button`}
                aria-label="Copy descriptor"
              />
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{descriptor.gapLimit}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{descriptor.skip || 0}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {descriptor.initialAddresses || 10}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{descriptor.addresses.length}</Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButtonStyled
              onClick={handleRefreshAll}
              icon={<RefreshIcon />}
              data-testid={`${descriptor.name}-refresh-all-button`}
              aria-label="Refresh all addresses"
              disabled={isRefreshing}
            />
            <IconButtonStyled
              onClick={handleEditClick}
              icon={<EditIcon />}
              data-testid={`${descriptor.name}-edit-button`}
              aria-label="Edit descriptor"
            />
            <IconButtonStyled
              onClick={handleDeleteClick}
              icon={<DeleteIcon />}
              data-testid={`${descriptor.name}-delete-button`}
              aria-label="Delete descriptor"
            />
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Table size="small" className="crystal-table address-subtable">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>Derivation Path</TableCell>
                    <TableCell>On-Chain</TableCell>
                    <TableCell>Mempool</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
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
                      onEditAddress={(_, address) =>
                        onEdit(collection, address)
                      }
                      derivationPath={`${descriptor.name} ${address.index}`}
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
