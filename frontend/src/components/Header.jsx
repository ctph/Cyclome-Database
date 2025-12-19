// components/Header.jsx
import React from "react";
import { Link } from "react-router-dom";
import { Typography } from "antd";

const { Title } = Typography;

const Header = () => (
  <div style={{ textAlign: "center", marginBottom: 16 }}>
    <Link to="/" style={{ textDecoration: "none" }}>
      <Title level={2} style={{ color: "#1677ff", marginBottom: 0 }}>
        Cyclome Database
      </Title>
    </Link>
  </div>
);

export default Header;
