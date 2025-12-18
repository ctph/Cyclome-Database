import React, { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

const PdbPage = () => {
  const { pdbId: rawParam } = useParams();
  const holderRef = useRef(null);

  const normalized = rawParam?.includes("_")
    ? rawParam.toLowerCase()
    : `${rawParam?.toLowerCase()}_a`;

  useEffect(() => {
    if (!holderRef.current) return;

    holderRef.current.innerHTML = "";

    // JSmol not loaded yet
    if (!window.Jmol) {
      holderRef.current.innerText =
        "JSmol not loaded. Check /public/jsmol and index.html script.";
      return;
    }

    const Info = {
      width: 600,
      height: 600,
      use: "HTML5",
      j2sPath: "/jsmol/j2s",
      serverURL: "https://chemapps.stolaf.edu/jmol/jsmol/php/jsmol.php",
      script: `
        load /api/pdb/file/${normalized};
        cartoon only;
        color structure;
      `,
    };

    const app = window.Jmol.getApplet("jsmolView", Info);
    holderRef.current.innerHTML = window.Jmol.getAppletHtml(app);
  }, [normalized]);

  return (
    <div>
      <div ref={holderRef} />
    </div>
  );
};

export default PdbPage;
