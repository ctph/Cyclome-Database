// import React, { useState, useEffect, useRef } from "react";
// import { Select, message } from "antd";
// import { useNavigate } from "react-router-dom";

// const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

// const SequenceSearchBar = () => {
//   const [value, setValue] = useState(null);
//   const [options, setOptions] = useState([]);
//   const [sequenceMap, setSequenceMap] = useState({}); // { "1a1p_a": "SEQUENCE..." }
//   const [allIds, setAllIds] = useState([]); // ["1a1p_a", ...]
//   const navigate = useNavigate();
//   const lastSearchedTerm = useRef(null);

//   // Load JSON once and build maps/options
//   useEffect(() => {
//     let cancelled = false;

//     async function loadSequences() {
//       try {
//         const res = await fetch(`${API_BASE}/api/pdb/all`);
//         if (!res.ok) throw new Error("Failed to fetch JSON");

//         const data = await res.json();

//         const map = {};
//         const ids = [];

//         for (const row of Array.isArray(data) ? data : []) {
//           const rawId = row?.PDB;
//           const seq = row?.Sequence;

//           if (!rawId || !seq) continue;

//           const id = String(rawId).trim().toLowerCase(); // "1a1p_a"
//           const sequence = String(seq).trim().toUpperCase();

//           // basic validation: keep IDs consistent with backend chainIndex keys
//           if (!/^[a-z0-9]+_[a-z0-9]+$/.test(id)) continue;

//           map[id] = sequence;
//           ids.push(id);
//         }

//         ids.sort();

//         if (!cancelled) {
//           setSequenceMap(map);
//           setAllIds(ids);

//           // show all by default
//           setOptions(
//             ids.map((id) => ({
//               label: id.toUpperCase(),
//               value: id, // keep lowercase for routes
//               sequence: map[id]?.toLowerCase() || "",
//             }))
//           );
//         }
//       } catch (e) {
//         if (!cancelled) message.error("Failed to load sequence JSON");
//       }
//     }

//     loadSequences();
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   const goToPdbPage = (id) => {
//     const chainId = String(id || "")
//       .trim()
//       .toLowerCase();
//     if (!chainId) return;
//     navigate(`/pdb/${chainId}`);
//   };

//   const handleSearch = (input) => {
//     const term = String(input || "").trim();
//     if (!term) return;

//     // prevent repeated work
//     if (term === lastSearchedTerm.current) return;
//     lastSearchedTerm.current = term;

//     const termLower = term.toLowerCase();
//     const termUpper = term.toUpperCase();

//     // 1) ID prefix match
//     const idMatches = allIds
//       .filter((id) => id.startsWith(termLower))
//       .slice(0, 20);

//     if (idMatches.length > 0) {
//       setOptions(
//         idMatches.map((id) => ({
//           label: id.toUpperCase(),
//           value: id,
//           sequence: (sequenceMap[id] || "").toLowerCase(),
//         }))
//       );

//       // auto-route if exactly one match
//       if (idMatches.length === 1) {
//         goToPdbPage(idMatches[0]);
//       }
//       return;
//     }

//     // 2) sequence substring match
//     if (term.length < 5) return;

//     const sequenceMatches = [];
//     for (const id of allIds) {
//       const seq = sequenceMap[id];
//       if (!seq) continue;

//       if (seq.includes(termUpper)) {
//         sequenceMatches.push([id, seq]);
//         if (sequenceMatches.length >= 5) break;
//       }
//     }

//     if (sequenceMatches.length === 1) {
//       goToPdbPage(sequenceMatches[0][0]);
//       return;
//     }

//     if (sequenceMatches.length === 0) return;

//     const displayLength = 30;
//     const key = `search-suggestions-${Date.now()}`;

//     message.info({
//       content: (
//         <div>
//           <p>No exact ID match. Sequence matches:</p>
//           <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 16 }}>
//             {sequenceMatches.map(([id, seq]) => {
//               let preview = seq.slice(0, displayLength);
//               if (seq.length > displayLength) preview += "...";
//               else preview = preview.padEnd(displayLength, " ");

//               return (
//                 <li key={id}>
//                   <a
//                     onClick={() => {
//                       message.destroy(key);
//                       goToPdbPage(id);
//                     }}
//                   >
//                     <strong>{id.toUpperCase()}</strong>
//                     <span
//                       style={{
//                         fontSize: "12px",
//                         color: "#888",
//                         marginLeft: 8,
//                         fontFamily: "monospace",
//                         whiteSpace: "pre",
//                       }}
//                     >
//                       {preview}
//                     </span>
//                   </a>
//                 </li>
//               );
//             })}
//           </ul>
//         </div>
//       ),
//       key,
//       duration: 6,
//     });
//   };

//   const handleChange = (selectedId) => {
//     setValue(selectedId);
//     goToPdbPage(selectedId);
//     lastSearchedTerm.current = null;
//   };

//   return (
//     <Select
//       showSearch
//       value={value}
//       placeholder="Search by PDB ID or sequence (sequence min 5 chars)"
//       style={{ width: "100%" }}
//       options={options}
//       onChange={handleChange}
//       onSearch={handleSearch}
//       filterOption={(input, option) => {
//         const t = String(input || "").toLowerCase();
//         if (!t) return true;

//         const label = String(option?.label || "").toLowerCase();
//         const seq = String(option?.sequence || "");
//         return label.includes(t) || seq.includes(t);
//       }}
//     />
//   );
// };

// export default SequenceSearchBar;

import React, { useEffect, useRef, useState } from "react";
import { Select, message } from "antd";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

const SequenceSearchBar = () => {
  const [value, setValue] = useState(null);
  const [options, setOptions] = useState([]);
  const [allIds, setAllIds] = useState([]);
  const navigate = useNavigate();

  const lastQueryRef = useRef("");
  const abortRef = useRef(null);
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pdb/seq-index`);
        if (!res.ok) throw new Error("failed");
        const data = await res.json();

        const rows = (data?.results || [])
          .map((r) => ({
            id: String(r.id).trim().toLowerCase(),
            sequence: String(r.sequence).trim().toUpperCase(),
          }))
          .filter((r) => r.id && r.sequence);

        const previewLen = 30;

        if (!cancelled) {
          setOptions(
            rows.map((r) => ({
              value: r.id,
              label: (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.id.toUpperCase()}</div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "#666",
                    }}
                  >
                    {r.sequence.slice(0, previewLen)}
                    {r.sequence.length > previewLen ? "..." : ""}
                  </div>
                </div>
              ),

              searchText: `${r.id} ${r.sequence}`.toLowerCase(),
            }))
          );
        }
      } catch (e) {
        if (!cancelled) message.error("Failed to load id+sequence index");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const go = (id) => {
    const chainId = String(id || "")
      .trim()
      .toLowerCase();
    if (!chainId) return;
    navigate(`/pdb/${chainId}`);
  };

  const handleSearch = async (input) => {
    const raw = String(input || "").trim();
    if (!raw) return;

    // cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Avoid repeating identical query
    if (raw === lastQueryRef.current) return;
    lastQueryRef.current = raw;

    const qLower = raw.toLowerCase();
    const qUpper = raw.toUpperCase();

    try {
      // 0) tiny input: local id prefix suggestions only
      if (qLower.length < 2) {
        const local = allIds
          .filter((id) => id.startsWith(qLower))
          .slice(0, 20)
          .map((id) => ({ label: id.toUpperCase(), value: id }));
        if (local.length) setOptions(local);
        return;
      }

      // 1) First try ID search (fast, what people usually type)
      const idRes = await fetch(
        `${API_BASE}/api/pdb/search?q=${encodeURIComponent(qLower)}&limit=20`,
        { signal: controller.signal }
      );
      if (idRes.ok) {
        const idData = await idRes.json();
        const idResults = (idData?.results || [])
          .map((x) => String(x).trim().toLowerCase())
          .filter((x) => /^[a-z0-9]+_[a-z0-9]+$/.test(x));

        if (idResults.length > 0) {
          setOptions(
            idResults.map((id) => ({
              label: id.toUpperCase(),
              value: id,
            }))
          );
          if (idResults.length === 1) go(idResults[0]);
          return;
        }
      }

      // 2) If no ID matches, try SEQUENCE search (min length 5)
      if (qUpper.length < 5) return;

      const seqRes = await fetch(
        `${API_BASE}/api/pdb/sequence-search?q=${encodeURIComponent(
          qUpper
        )}&limit=5`,
        { signal: controller.signal }
      );
      if (!seqRes.ok) throw new Error("sequence search failed");

      const seqData = await seqRes.json();

      // expected: { results: [{ id: "1a1p_a", sequence: "..." }, ...] }
      const seqResults = (seqData?.results || [])
        .map((r) => ({
          id: String(r?.id || "")
            .trim()
            .toLowerCase(),
          seq: String(r?.sequence || "")
            .trim()
            .toUpperCase(),
        }))
        .filter((r) => /^[a-z0-9]+_[a-z0-9]+$/.test(r.id) && r.seq);

      if (seqResults.length === 0) return;

      // show results (you can include a seq preview if you want)
      setOptions(
        seqResults.map((r) => ({
          label: r.id.toUpperCase(),
          value: r.id,
        }))
      );

      if (seqResults.length === 1) go(seqResults[0].id);
    } catch (e) {
      if (e.name === "AbortError") return;
      message.error("Search failed");
    }
  };

  const handleChange = (selectedId) => {
    setValue(selectedId);
    go(selectedId);
    lastQueryRef.current = "";
  };

  return (
    <Select
      showSearch
      value={value}
      placeholder="Search by PDB ID or sequence (sequence min 5 chars)"
      style={{ width: "100%" }}
      options={options}
      onSearch={handleSearch}
      onChange={handleChange}
      filterOption={false} // server-side search
    />
  );
};

export default SequenceSearchBar;
