import React, { useState, useEffect, useRef } from "react";
import { Select, message } from "antd";
import { useNavigate } from "react-router-dom";
import levenshtein from "fast-levenshtein";

const SearchBar = () => {
  const [value, setValue] = useState(null);
  const [options, setOptions] = useState([]);
  const [allPdbIds, setAllPdbIds] = useState([]);
  const navigate = useNavigate();
  const lastSearchedTerm = useRef(null);

  useEffect(() => {}, []);

  const findNearestMatches = (searchTerm) => {
    const distances = allPdbIds.map((pdbId) => ({
      pdbId,
      distance: levenshtein.get(searchTerm.toLowerCase(), pdbId.toLowerCase()),
    }));

    return distances
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map((item) => item.pdbId);
  };

  const handleSearch = (searchTerm) => {
    if (!searchTerm || searchTerm.length < 4) return;
    if (searchTerm === lastSearchedTerm.current) return;

    lastSearchedTerm.current = searchTerm;

    const exactMatch = allPdbIds.find(
      (pdbId) => pdbId.toLowerCase() === searchTerm.toLowerCase()
    );

    if (!exactMatch) {
      const nearestMatches = findNearestMatches(searchTerm);
      const key = `search-suggestions-${Date.now()}`;

      message.info({
        content: (
          <div>
            <p>No exact match found. Did you mean:</p>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              {nearestMatches.map((match) => (
                <li key={match}>
                  <a
                    onClick={() => {
                      message.destroy(key);
                      navigate(`/similarity/${match}`);
                    }}
                  >
                    {match.toUpperCase()}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ),
        key,
        duration: 5,
      });
    }
  };

  const handleChange = (selectedFilename) => {
    const pdbId = selectedFilename.replace(".pdb", "").toLowerCase();
    setValue(selectedFilename);
    navigate(`/similarity/${pdbId}`);
    lastSearchedTerm.current = null; // Reset on selection
  };

  return (
    <Select
      showSearch
      value={value}
      placeholder="Search PDBs (min 4 chars, e.g. 1A1P)"
      style={{ width: "100%" }}
      options={options}
      onChange={handleChange}
      onSearch={handleSearch}
      filterOption={(input, option) =>
        option?.label?.toUpperCase().includes(input.toUpperCase())
      }
    />
  );
};

export default SearchBar;
