import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

function Footer(props) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      align="center"
      {...props}
    >
      {"Made with ❤️ and 🤖 by ⚡️"}
      <Link color="inherit" target="zap" href="https://zapomatic.github.io/">
        Zap-O-Matic
      </Link>
    </Typography>
  );
}

export default Footer;
