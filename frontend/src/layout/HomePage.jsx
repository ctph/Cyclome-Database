import React from "react";
// import "./HomePage.css";
import SearchBar from "../components/SearchBar";
import HomeTable from "../components/HomeTable";
import Header from "../components/Header";
import { Space } from "antd";
// import SequenceSearchBar from "../components/SequenceSearchBar";

const HomePage = ({ allOptions }) => {
  const handleSearch = (query) => {
    console.log("User searched for:", query);
  };

  return (
    <div className="home-container">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Header />
        <div style={{ marginLeft: "20px", width: "calc(100% - 40px)" }}>
          <h2 style={{ fontFamily: "Arial, sans-serif" }}>PDB_ID Search Bar</h2>
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
            {/* PDB Sequence Search Bar */}
          </h2>
          {/* <SequenceSearchBar allOptions={allOptions} /> */}
        </div>
        <div style={{ marginTop: 32 }}>
          <HomeTable />
        </div>
      </Space>
    </div>
  );
};

export default HomePage;
