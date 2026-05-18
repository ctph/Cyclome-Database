import React from "react";
import { Link } from "react-router-dom";
// import "./HomePage.css";
import SearchBar from "../components/SearchBar";
import HomeTable from "../components/HomeTable";
import Header from "../components/Header";
import { Button, Space } from "antd";
import SequenceSearchBar from "../components/SequenceSearchBar";

const HomePage = ({ allOptions }) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "20px",
        }}
      >
        <h2
          style={{
            fontSize: "36px",
            marginBottom: "16px",
          }}
        >
          Please open this website in desktop view
        </h2>
      </div>
    );
  }

  return (
    <div className="home-container">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Header />
        <div style={{ marginLeft: "20px", width: "calc(100% - 40px)" }}>
          <h2 style={{ fontFamily: "Arial, sans-serif" }}>PDB Search</h2>
          <SearchBar allOptions={allOptions} />
        </div>

        <div
          style={{
            marginLeft: "20px",
            width: "calc(100% - 40px)",
            marginTop: "24px",
          }}
        >
          <h2 style={{ fontFamily: "Arial, sans-serif" }}>Sequence Search</h2>
          <SequenceSearchBar allOptions={allOptions} />
        </div>
        <div
          style={{
            marginLeft: "20px",
            width: "calc(100% - 40px)",
            marginTop: "8px",
          }}
        >
          <h2 style={{ fontFamily: "Arial, sans-serif" }}>Tools</h2>
          <Space wrap>
            <Link to="/cyclic-sequence-similarity">
              <Button type="primary">Cyclic Sequence Similarity</Button>
            </Link>
            <Link to="/criticl">
              <Button type="primary">CritiCL</Button>
            </Link>
            <Link to="/stop2melt">
              <Button type="primary">STop2Melt</Button>
            </Link>
          </Space>
        </div>

        <div style={{ marginTop: 32 }}>
          <HomeTable />
        </div>
      </Space>
    </div>
  );
};

export default HomePage;
