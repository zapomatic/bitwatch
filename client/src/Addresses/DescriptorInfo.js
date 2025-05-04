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

const DescriptorInfo = ({
  descriptor,
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
    onEdit(descriptor);
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete({ descriptor });
  };

  const handleAddressDelete = (address) => {
    onDelete({
      collection: collection.name,
      address: address.address,
      descriptor: descriptor,
    });
  };

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(descriptor.descriptor);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <TableRow
        className="crystal-table-row descriptor-row"
        sx={{ "& > *": { borderBottom: "unset" } }}
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
              {descriptor.descriptor.slice(0, 8)}...
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
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Table size="small" className="crystal-table address-subtable">
                <TableBody>
                  {descriptor.addresses.map((address) => (
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

export default DescriptorInfo;
