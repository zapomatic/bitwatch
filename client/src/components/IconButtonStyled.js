import { IconButton } from "@mui/material";
import React from "react";

const IconButtonStyled = React.forwardRef(
  (
    {
      onClick,
      icon,
      title,
      variant = "default",
      className,
      size = "small",
      ...props
    },
    ref
  ) => {
    const buttonClass = `crystal-icon-button ${
      variant === "success"
        ? "crystal-action-button-success"
        : variant === "danger"
        ? "crystal-action-button-danger"
        : ""
    } ${className || ""}`.trim();

    return (
      <IconButton
        ref={ref}
        size={size}
        onClick={onClick}
        className={buttonClass}
        title={title}
        {...props}
      >
        {icon}
      </IconButton>
    );
  }
);

IconButtonStyled.displayName = "IconButtonStyled";

export default IconButtonStyled;
