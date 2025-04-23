import { IconButton } from "@mui/material";

const IconButtonStyled = ({
  onClick,
  icon,
  title,
  variant = "default",
  className,
  size = "medium",
  ...props
}) => {
  const buttonClass = `crystal-icon-button ${
    variant === "success"
      ? "crystal-action-button-success"
      : variant === "danger"
      ? "crystal-action-button-danger"
      : ""
  } ${className || ""}`.trim();

  return (
    <IconButton
      size={size}
      onClick={onClick}
      className={buttonClass}
      title={title}
      {...props}
    >
      {icon}
    </IconButton>
  );
};

export default IconButtonStyled;
