import React from "react";
import { Link } from "react-router-dom";
// import "./HomePage.css";
import SearchBar from "../components/SearchBar";
import HomeTable from "../components/HomeTable";
import Header from "../components/Header";
import SequenceSearchBar from "../components/SequenceSearchBar";

const authorLinks = {
  karuna: "https://chowdhurylab.github.io/author.html?author=karuna-anna-sajeevan",
  curwen: "https://chowdhurylab.github.io/author.html?author=curwen-pei-hong-tan",
  riza: "https://chowdhurylab.github.io/author.html?author=riza-danurdoro",
};

const HomePage = ({ allOptions }) => {
  return (
    <div className="home-container">
      <Header />

      <main className="cyclome-home-main">
        <section className="cyclome-search-column">
          <div className="section-head">
            <span className="badge">SEARCH</span>
            <div>
              <h2>Find cyclic peptide records</h2>
              <p className="sub">
                Search curated structures by PDB chain or peptide sequence, then
                open a structure page for visualization, metadata, and stability
                context.
              </p>
            </div>
          </div>

          <div className="credit-bubble" aria-label="Cyclome contributor credits">
            <div className="credit-line">
              <span>Science</span>
              <a href={authorLinks.karuna} target="_blank" rel="noopener noreferrer">
                Karuna Anna Sajeevan
              </a>
            </div>
            <div className="credit-line">
              <span>Software</span>
              <span>
                <a href={authorLinks.curwen} target="_blank" rel="noopener noreferrer">
                  Curwen Pei Hong Tan
                </a>
                {", "}
                <a href={authorLinks.riza} target="_blank" rel="noopener noreferrer">
                  Riza Danurdoro
                </a>
              </span>
            </div>
          </div>

          <div className="card search-card">
            <div className="search-top">
              <div>
                <h3>PDB Search</h3>
                <p>Prefix search across Cyclome structure IDs.</p>
              </div>
              <span className="dot" aria-hidden="true" />
            </div>
            <div className="query-field">
              <SearchBar allOptions={allOptions} />
            </div>
          </div>

          <div className="card search-card">
            <div className="search-top">
              <div>
                <h3>Sequence Search</h3>
                <p>Search peptide chains by sequence fragment.</p>
              </div>
              <span className="dot" aria-hidden="true" />
            </div>
            <div className="query-field">
              <SequenceSearchBar allOptions={allOptions} />
            </div>
          </div>

          <div className="download">
            <div className="filter-title">
              <span className="dot" aria-hidden="true" />
              Tools
            </div>
            <div className="tool-grid">
              <Link className="mini phosfate-action" to="/cyclic-sequence-similarity">
                <b>Cyclic Sequence Similarity</b>
                <span>Compare peptide sequences against Cyclome similarity routes.</span>
              </Link>
              <Link className="mini" to="/criticl">
                <b>CritiCL</b>
                <span>Predict likely metal class from sequence and cyclization inputs.</span>
              </Link>
              <Link className="mini" to="/stop2melt">
                <b>STop2Melt</b>
                <span>Run sequence-level stability inference with queued backend jobs.</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="cyclome-results-column">
          <div className="section-head">
            <span className="badge">DATA</span>
            <div>
              <h2>Cyclome records</h2>
              <p className="sub">
                Expand a sequence group to view available structures, open 3D
                records, or download curated PDB files.
              </p>
            </div>
          </div>

          <div className="result-card">
            <HomeTable />
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;
