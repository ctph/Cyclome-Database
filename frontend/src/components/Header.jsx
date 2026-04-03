// components/Header.jsx
import React from "react";
import { Link } from "react-router-dom";
import { Typography } from "antd";

const { Title } = Typography;

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(0, 0, 0, 0.42)",
  minWidth: 70,
};

const valueStyle = {
  fontSize: 14,
  color: "rgba(0, 0, 0, 0.72)",
};

const linkStyle = {
  color: "#1677ff",
  textDecoration: "none",
  fontWeight: 500,
};

const Header = () => (
  <header
    style={{
      position: "relative",
      marginBottom: 18,
      paddingTop: 8,
      minHeight: 96,
    }}
  >
    <div style={{ textAlign: "center" }}>
      <Link to="/" style={{ textDecoration: "none" }}>
        <Title
          level={2}
          style={{
            color: "#1677ff",
            marginBottom: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Cyclome Database
        </Title>
      </Link>
    </div>

    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 300,
        padding: "12px 14px",
        border: "1px solid rgba(22, 119, 255, 0.10)",
        borderRadius: 14,
        background: "rgba(250, 252, 255, 0.92)",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
        backdropFilter: "blur(8px)",
      }}
    >
      <a
        href="https://chowdhurylab.github.io/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(0, 0, 0, 0.58)",
          textDecoration: "none",
        }}
      >
        Chowdhury Lab
      </a>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={labelStyle}>Science</span>
        <a
          href="https://chowdhurylab.github.io/author.html?author=karuna-anna-sajeevan"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          Karuna
        </a>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={labelStyle}>Software</span>
        <span style={valueStyle}>Curwen, Riza</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={labelStyle}>Paper</span>
        <span style={{ ...valueStyle, color: "rgba(0, 0, 0, 0.42)" }}>Coming soon</span>
      </div>
    </div>
  </header>
);

export default Header;
