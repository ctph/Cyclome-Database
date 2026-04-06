import React from "react";
import { Link } from "react-router-dom";
// import "./HomePage.css";
import SearchBar from "../components/SearchBar";
import HomeTable from "../components/HomeTable";
import Header from "../components/Header";
import { Button, Space } from "antd";
import SequenceSearchBar from "../components/SequenceSearchBar";

const HomePage = ({ allOptions }) => {
  const handleSearch = (query) => {
    console.log("User searched for:", query);
  };

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
          <h2 style={{ fontFamily: "Arial, sans-serif" }}>
            Sequence Search
          </h2>
          <SequenceSearchBar allOptions={allOptions} />
        </div>
        <div
          style={{
            marginLeft: "20px",
            width: "calc(100% - 40px)",
            marginTop: "8px",
          }}
        >
          <h2 style={{ fontFamily: "Arial, sans-serif" }}>
            Tools
          </h2>
          <Space wrap>
            <Link to="/cyclic-sequence-similarity">
              <Button type="primary">Cyclic Sequence Similarity</Button>
            </Link>
            <Link to="/stop2melt">
              <Button>STop2Melt</Button>
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
