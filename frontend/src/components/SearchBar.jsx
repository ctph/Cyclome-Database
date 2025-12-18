import React, { useState, useEffect, useRef } from "react";
import { Select, message } from "antd";
import { useNavigate } from "react-router-dom";
import levenshtein from "fast-levenshtein";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

const SearchBar = () => {
  const [value, setValue] = useState(null);
  const [options, setOptions] = useState([]);
  const [allPdbIds, setAllPdbIds] = useState([]);
  const navigate = useNavigate();
  const lastSearchedTerm = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAllIds() {
      try {
        const res = await fetch(`${API_BASE}/api/pdb/all`);
        const data = await res.json();

        if (!cancelled && Array.isArray(data.results)) {
          setAllPdbIds(data.results);

          setOptions(
            data.results.map((id) => ({
              label: id.toUpperCase(),
              value: id.toLowerCase(),
            }))
          );
        }
      } catch {
        message.error("Failed to load PDB list from backend");
      }
    }

    loadAllIds();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleSearch = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 4) return;
    if (searchTerm === lastSearchedTerm.current) return;

    lastSearchedTerm.current = searchTerm;

    // Populate dropdown from backend (fast prefix search)
    try {
      const res = await fetch(
        `${API_BASE}/api/pdb/search?q=${encodeURIComponent(
          searchTerm.toLowerCase()
        )}&limit=50`
      );
      const data = await res.json();
      const ids = Array.isArray(data?.results) ? data.results : [];

      setOptions(
        ids.map((id) => ({
          label: id.toUpperCase(),
          value: id.toLowerCase(), // normalized selection value
        }))
      );
    } catch (e) {
      // don’t change logic; just fail quietly
    }

    // Keep your original exact match + suggestion logic exactly
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
                      navigate(`/similarity/${match.toLowerCase()}`);
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

  const handleChange = (selectedIdLower) => {
    // selectedIdLower is already normalized
    setValue(selectedIdLower);
    navigate(`/similarity/${selectedIdLower}`);
    lastSearchedTerm.current = null;
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
      filterOption={false} // IMPORTANT: backend does filtering; keep logic unchanged
    />
  );
};

export default SearchBar;
