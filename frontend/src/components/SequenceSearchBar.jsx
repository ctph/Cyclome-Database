// import React, { useState, useEffect, useRef } from "react";
// import { Select, message } from "antd";
// import { useNavigate } from "react-router-dom";

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
//         const res = await fetch("/static/sequence_similarity_sorted.json");
//         const data = await res.json();

//         // Build { idLower: sequenceUpper }
//         const map = {};
//         const ids = [];

//         for (const row of Array.isArray(data) ? data : []) {
//           const rawId = row?.PDB;
//           const seq = row?.Sequence;

//           if (!rawId || !seq) continue;

//           const id = String(rawId).trim().toLowerCase(); // normalize id
//           const sequence = String(seq).trim().toUpperCase();

//           map[id] = sequence;
//           ids.push(id);
//         }

//         ids.sort();

//         if (!cancelled) {
//           setSequenceMap(map);
//           setAllIds(ids);

//           // Show all by default (946 is fine)
//           setOptions(
//             ids.map((id) => ({
//               label: id.toUpperCase(),
//               value: id, // keep lowercase for routes
//               sequence: map[id].toLowerCase(), // used by filterOption
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

//   const handleSearch = (input) => {
//     const term = String(input || "").trim();
//     if (!term) return;

//     // prevent repeated work
//     if (term === lastSearchedTerm.current) return;
//     lastSearchedTerm.current = term;

//     const termLower = term.toLowerCase();
//     const termUpper = term.toUpperCase();

//     // ✅ 1) If user typed a PDB-like id, prioritize ID matching (prefix)
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

//       // If exactly one, auto-navigate (same vibe as your original)
//       if (idMatches.length === 1) {
//         navigate(`/similarity/${idMatches[0]}`);
//       }
//       return;
//     }

//     // ✅ 2) Otherwise treat it as a sequence substring search
//     // Use min length to avoid expensive scans + too many hits
//     if (term.length < 5) return;

//     const sequenceMatches = [];
//     for (const id of allIds) {
//       const seq = sequenceMap[id];
//       if (!seq) continue;

//       if (seq.includes(termUpper)) {
//         sequenceMatches.push([id, seq]);
//         if (sequenceMatches.length >= 5) break; // max 5 suggestions like your code
//       }
//     }

//     if (sequenceMatches.length === 1) {
//       navigate(`/similarity/${sequenceMatches[0][0]}`);
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
//                       navigate(`/similarity/${id}`);
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
//     navigate(`/similarity/${selectedId}`);
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
//       // local filtering for dropdown typing (works because options include sequence)
//       filterOption={(input, option) => {
//         const t = String(input || "").toLowerCase();
//         if (!t) return true;

//         const label = String(option?.label || "").toLowerCase();
//         const seq = String(option?.sequence || ""); // already lower
//         return label.includes(t) || seq.includes(t);
//       }}
//     />
//   );
// };

// export default SequenceSearchBar;
