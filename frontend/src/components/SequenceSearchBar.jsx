import React, { useState, useEffect, useRef } from "react";
import { Select, message } from "antd";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "";

const SequenceSearchBar = () => {
  const [value, setValue] = useState(null);
  const [options, setOptions] = useState([]);
  const [sequenceMap, setSequenceMap] = useState({});
  const navigate = useNavigate();
  const lastSearchedTerm = useRef(null);

  // Load from backend API and build sorted options
  useEffect(() => {
    fetch(`${API_BASE}/api/pdb/seq-index`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data.results)) {
          throw new Error("Invalid response");
        }

        // Build sequenceMap: { "1a1p_a": "SEQUENCE", ... }
        const seqMap = {};
        data.results.forEach((item) => {
          seqMap[item.id] = item.sequence;
        });

        setSequenceMap(seqMap);

        const chainIds = Object.keys(seqMap).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true }),
        );

        const displayLength = 30;

        const opt = chainIds.map((chainId) => {
          let seq = seqMap[chainId] || "";
          let trimmed = seq.slice(0, displayLength);
          if (seq.length > displayLength) {
            trimmed += "...";
          } else {
            trimmed = trimmed.padEnd(displayLength, " ");
          }

          return {
            label: (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong>{chainId.toUpperCase()}</strong>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#888",
                    whiteSpace: "pre",
                    fontFamily: "monospace",
                  }}
                >
                  {trimmed}
                </div>
              </div>
            ),
            value: chainId,
            sequence: seq.toLowerCase(), // for filtering
          };
        });

        setOptions(opt);
      })
      .catch(() => {
        message.error("Failed to load sequences from backend");
      });
  }, []);

  const handleSearch = (input) => {
    if (!input || input.length < 3) return;

    const inputLower = input.toLowerCase();

    // Only skip if it's exactly the same term AND we haven't cleared it
    if (inputLower === lastSearchedTerm.current) return;

    lastSearchedTerm.current = inputLower;

    const sequenceMatches = Object.entries(sequenceMap)
      .filter(([_, seq]) => seq.toLowerCase().includes(inputLower))
      .slice(0, 5);

    if (sequenceMatches.length === 1) {
      const chainId = sequenceMatches[0][0];
      navigate(`/pdb/${chainId}`);
      lastSearchedTerm.current = null; // Reset so it can trigger again
      return;
    }

    if (sequenceMatches.length === 0) {
      lastSearchedTerm.current = null; // Reset so user can try again
      return;
    }

    const displayLength = 30;
    const key = `search-suggestions-${Date.now()}`;

    message.info({
      content: (
        <div>
          <p>No exact match. Did you mean:</p>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 16 }}>
            {sequenceMatches.map(([chainId, seq]) => {
              let preview = seq.slice(0, displayLength);
              if (seq.length > displayLength) preview += "...";
              else preview = preview.padEnd(displayLength, " ");

              return (
                <li key={chainId}>
                  <a
                    onClick={() => {
                      message.destroy(key);
                      navigate(`/pdb/${chainId}`);
                      lastSearchedTerm.current = null; // Reset after navigation
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <strong>{chainId.toUpperCase()}</strong>
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
      onClose: () => {
        lastSearchedTerm.current = null; // Reset when message closes
      },
    });
  };

  const handleChange = (selectedChainId) => {
    setValue(selectedChainId);
    navigate(`/pdb/${selectedChainId}`);
    lastSearchedTerm.current = null;
  };

  const handleClear = () => {
    setValue(null);
    lastSearchedTerm.current = null;
  };

  return (
    <Select
      showSearch
      allowClear
      value={value}
      placeholder="Search by sequence (min 3 chars)"
      style={{ width: "100%" }}
      options={options}
      onChange={handleChange}
      onSearch={handleSearch}
      onClear={handleClear}
      filterOption={(input, option) =>
        option?.sequence?.includes(input.toLowerCase())
      }
    />
  );
};

export default SequenceSearchBar;
