import React, { useState, useEffect, useRef } from "react";
import { Select, message } from "antd";
import { useNavigate } from "react-router-dom";
import levenshtein from "fast-levenshtein";

const API_BASE = process.env.REACT_APP_API_BASE || "";

const SearchBar = () => {
  const [value, setValue] = useState(null);
  const [options, setOptions] = useState([]);
  const [allPdbIds, setAllPdbIds] = useState([]);
  const navigate = useNavigate();

  const lastSearchTerm = useRef("");
  const lastInfoKey = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAllIds() {
      try {
        const res = await fetch(`${API_BASE}/api/pdb/all`);
        const data = await res.json();

        if (!cancelled && Array.isArray(data.results)) {
          const ids = data.results.map((x) => String(x || "").trim()).filter(Boolean);
          setAllPdbIds(ids);

          setOptions(
            ids.slice(0, 200).map((id) => ({
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
    const term = String(searchTerm || "").toLowerCase();

    const distances = allPdbIds.map((pdbId) => ({
      pdbId,
      distance: levenshtein.get(term, String(pdbId || "").toLowerCase()),
    }));

    return distances
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map((item) => item.pdbId);
  };

  const setPrefixOptions = (termLower, limit = 200) => {
    if (!termLower) {
      setOptions(
        allPdbIds.slice(0, limit).map((id) => ({
          label: id.toUpperCase(),
          value: id.toLowerCase(),
        }))
      );
      return;
    }

    const matches = allPdbIds
      .filter((id) => String(id).toLowerCase().startsWith(termLower))
      .slice(0, limit);

    setOptions(
      matches.map((id) => ({
        label: id.toUpperCase(),
        value: id.toLowerCase(),
      }))
    );
  };

  const handleSearch = (searchTerm) => {
    const term = String(searchTerm || "").trim().toLowerCase();

    if (term === lastSearchTerm.current) return;
    lastSearchTerm.current = term;

    // Pure prefix filtering from 1+ chars (instant)
    setPrefixOptions(term, 200);

    // Only show "Did you mean" suggestions when user has typed enough
    // and prefix filtering found nothing.
    if (term.length >= 4) {
      const anyPrefix = allPdbIds.some((id) => String(id).toLowerCase().startsWith(term));
      if (!anyPrefix) {
        const nearest = findNearestMatches(term);

        const key = `search-suggestions-${Date.now()}`;
        lastInfoKey.current = key;

        message.info({
          content: (
            <div>
              <p>No prefix match found. Did you mean:</p>
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                {nearest.map((match) => (
                  <li key={match}>
                    <a
                      onClick={() => {
                        message.destroy(key);
                        navigate(`/pdb/${String(match).toLowerCase()}`);
                      }}
                    >
                      {String(match).toUpperCase()}
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
    }
  };

  const handleChange = (selectedIdLower) => {
    setValue(selectedIdLower);
    navigate(`/pdb/${selectedIdLower}`);
    lastSearchTerm.current = "";
  };

  const handleClear = () => {
    setValue(null);
    lastSearchTerm.current = "";
    setPrefixOptions("", 200);
    if (lastInfoKey.current) message.destroy(lastInfoKey.current);
  };

  return (
    <Select
      showSearch
      allowClear
      value={value}
      placeholder="Search PDBs by prefix (e.g. 1C, 2B, 1A1P)"
      style={{ width: "100%" }}
      options={options}
      onChange={handleChange}
      onSearch={handleSearch}
      onClear={handleClear}
      filterOption={false}
    />
  );
};

export default SearchBar;
