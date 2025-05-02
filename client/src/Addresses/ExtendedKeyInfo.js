import React, { useState } from "react";
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
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import IconButtonStyled from "../components/IconButtonStyled";
import AddressRow from "./AddressRow";

const ExtendedKeyInfo = ({
  extendedKey,
  onEdit,
  onDelete,
  collection,
  onEditAddress,
  onSaveExpected,
  displayBtc,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

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
    onDelete({ extendedKey });
  };

  const handleAddressDelete = (address) => {
    onDelete({
      collection: collection.name,
      address: address.address,
      extendedKey: extendedKey,
    });
  };

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(extendedKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <TableRow
        className="crystal-table-row address-row"
        sx={{ "& > *": { borderBottom: "unset" } }}
      >
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={handleExpandClick}
              sx={{ mr: 1 }}
              data-testid={isExpanded ? "collapse-button" : "expand-button"}
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            <Typography variant="body2">{extendedKey.name}</Typography>
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
            <IconButtonStyled onClick={handleEditClick} icon={<EditIcon />} />
            <IconButtonStyled
              onClick={handleDeleteClick}
              icon={<DeleteIcon />}
              data-testid="delete-button"
            />
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Table size="small" className="crystal-table address-subtable">
                <TableBody>
                  {(extendedKey.addresses || []).map((address) => (
                    <AddressRow
                      key={address.address}
                      address={address}
                      collection={collection}
                      onEditAddress={onEditAddress}
                      onSaveExpected={onSaveExpected}
                      onDelete={handleAddressDelete}
                      displayBtc={displayBtc}
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
