import React, { useState, useEffect, useRef } from "react";
import { Select, message } from "antd";
import { useNavigate } from "react-router-dom";

const SequenceSearchBar = () => {
  const [value, setValue] = useState(null);
  const [options, setOptions] = useState([]);
  const [sequenceMap, setSequenceMap] = useState({});
  const navigate = useNavigate();
  const lastSearchedTerm = useRef(null);

  // Load JSON and build sorted options
  useEffect(() => {}, []);

  const handleSearch = (input) => {
    if (!input || input.length < 3) return;
    if (input === lastSearchedTerm.current) return;

    lastSearchedTerm.current = input.toLowerCase();

    const sequenceMatches = Object.entries(sequenceMap)
      .filter(([_, seq]) => seq.toLowerCase().includes(input.toLowerCase()))
      .slice(0, 5); // max 5 suggestions

    if (sequenceMatches.length === 1) {
      navigate(`/similarity/${sequenceMatches[0][0]}`);
      return;
    }

    if (sequenceMatches.length === 0) return;

    const displayLength = 30;
    const key = `search-suggestions-${Date.now()}`;

    message.info({
      content: (
        <div>
          <p>No exact match. Did you mean:</p>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 16 }}>
            {sequenceMatches.map(([pdbId, seq]) => {
              let preview = seq.slice(0, displayLength);
              if (seq.length > displayLength) preview += "...";
              else preview = preview.padEnd(displayLength, " ");

              return (
                <li key={pdbId}>
                  <a
                    onClick={() => {
                      message.destroy(key);
                      navigate(`/similarity/${pdbId}`);
                    }}
                  >
                    <strong>{pdbId.toUpperCase()}</strong>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#888",
                        marginLeft: 8,
                        fontFamily: "monospace",
                        whiteSpace: "pre",
                      }}
                    >
                      {preview}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ),
      key,
      duration: 6,
    });
  };

  const handleChange = (selectedPdbId) => {
    setValue(selectedPdbId);
    navigate(`/similarity/${selectedPdbId}`);
    lastSearchedTerm.current = null;
  };

  return (
    <Select
      showSearch
      value={value}
      placeholder="Search by sequence (min 5 chars)"
      style={{ width: "100%" }}
      options={options}
      onChange={handleChange}
      onSearch={handleSearch}
      filterOption={(input, option) =>
        option?.sequence?.includes(input.toLowerCase())
      }
    />
  );
};

export default SequenceSearchBar;
