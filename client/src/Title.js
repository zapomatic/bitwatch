import * as React from "react";
import PropTypes from "prop-types";
import Typography from "@mui/material/Typography";
import "./theme.css";

function Title(props) {
  return (
    <Typography
      component="h2"
      variant="h6"
      sx={{
        color: "var(--theme-secondary)",
        textShadow: "0 0 10px var(--theme-glow-secondary)",
        fontFamily: '"Roboto Mono", monospace',
        letterSpacing: "0.1em",
        marginBottom: "1rem",
      }}
      gutterBottom
    >
      {props.children}
    </Typography>
  );
}

Title.propTypes = {
  children: PropTypes.node,
};

export default Title;
