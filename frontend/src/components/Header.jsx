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
    {/* Agrivax link */}
    {/* Title row */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        marginBottom: 18,
        paddingTop: 8,
        width: "100%",
      }}
    >
      {/* Left Agrivax link */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "rgba(0, 0, 0, 0.75)",
          whiteSpace: "nowrap",
          paddingLeft: 10,
        }}
      >
        An{" "}
        <a
          href="https://agrivax.studio"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#1677ff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          AgriVax.studio
        </a>{" "}
        collection
      </div>

      {/* Center title */}
      <div style={{ justifySelf: "center" }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <Title
            level={2}
            style={{
              color: "#1677ff",
              margin: 0,
              letterSpacing: "-0.02em",
              textAlign: "center",
            }}
          >
            Cyclome Database
          </Title>
        </Link>
      </div>

      {/* Spacer to balance layout */}
      <div style={{ width: 180 }} />
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

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 6,
        }}
      >
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

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span style={labelStyle}>Software</span>
        <span style={valueStyle}>Curwen, Riza</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={labelStyle}>Paper</span>
        <a
          href="https://www.biorxiv.org/content/10.1101/2026.04.08.717280v1"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          Cyclome bioRxiv preprint
        </a>
      </div>
    </div>
  </header>
);

export default Header;
