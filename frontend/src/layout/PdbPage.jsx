// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useParams } from "react-router-dom";
// import { Card, Spin, Typography, Tag, Space, Divider } from "antd";

// const { Title, Text } = Typography;

// const PdbPage = () => {
//   const { pdbId } = useParams(); // e.g. "1a1p_a"
//   const containerRef = useRef(null);

//   const [metaLoading, setMetaLoading] = useState(true);
//   const [metaError, setMetaError] = useState(null);
//   const [metaRecord, setMetaRecord] = useState(null);

//   const pdbIdUpper = useMemo(() => String(pdbId || "").toUpperCase(), [pdbId]);

//   // ---- JSmol (unchanged) ----
//   useEffect(() => {
//     if (!window.Jmol) return;
//     if (!containerRef.current) return;

//     containerRef.current.innerHTML = "";

//     const Info = {
//       width: 600,
//       height: 600,
//       debug: false,
//       color: "white",
//       addSelectionOptions: false,
//       use: "HTML5",
//       j2sPath: "/jsmol/j2s",
//       serverURL: "https://chemapps.stolaf.edu/jmol/jsmol/php/jsmol.php",
//       script: `
//         load "/api/pdb/file/${pdbId}";
//         cartoon only;
//         color structure;
//       `,
//     };

//     const applet = window.Jmol.getApplet("jsmolApplet", Info);
//     containerRef.current.innerHTML = window.Jmol.getAppletHtml(applet);
//   }, [pdbId]);

//   // ---- Metadata fetch from backend (same host) ----
//   useEffect(() => {
//     let cancelled = false;

//     async function loadMeta() {
//       setMetaLoading(true);
//       setMetaError(null);
//       setMetaRecord(null);

//       try {
//         const res = await fetch(`/api/meta/${pdbId}`);
//         if (!res.ok) {
//           if (res.status === 404) {
//             if (!cancelled) setMetaRecord(null);
//             return;
//           }
//           throw new Error(`Metadata fetch failed: ${res.status}`);
//         }

//         const obj = await res.json(); // ✅ single record
//         if (!cancelled) setMetaRecord(obj);
//       } catch (e) {
//         if (!cancelled) setMetaError(e.message || "Failed to load metadata");
//       } finally {
//         if (!cancelled) setMetaLoading(false);
//       }
//     }

//     if (pdbId) loadMeta();
//     return () => {
//       cancelled = true;
//     };
//   }, [pdbId]);

//   return (
//     <div
//       style={{
//         display: "flex",
//         gap: 16,
//         alignItems: "flex-start",
//         flexWrap: "wrap",
//       }}
//     >
//       {/* Left: JSmol */}
//       <div>
//         <Title level={3} style={{ marginTop: 0 }}>
//           PDB Viewer: {pdbIdUpper}
//         </Title>
//         <div ref={containerRef} />
//       </div>

//       {/* Right: Metadata card */}
//       <Card title="Metadata" style={{ width: 420 }}>
//         {metaLoading ? (
//           <Spin />
//         ) : metaError ? (
//           <Text type="danger">{metaError}</Text>
//         ) : !metaRecord ? (
//           <Text type="secondary">No metadata found</Text>
//         ) : (
//           <Space direction="vertical" size="small" style={{ width: "100%" }}>
//             <div>
//               <Text type="secondary">Cyclization</Text>
//               <div style={{ marginTop: 4 }}>
//                 <Tag color="blue">
//                   {String(metaRecord.Cyclization || "Unknown")}
//                 </Tag>
//               </div>
//             </div>

//             <div>
//               <Text type="secondary">Organism</Text>
//               <div style={{ marginTop: 4 }}>
//                 {metaRecord.Organism_Scientific_Name || "N/A"}
//               </div>
//             </div>

//             <Divider style={{ margin: "8px 0" }} />

//             <div>
//               <Text type="secondary">Method</Text>
//               <div style={{ marginTop: 4 }}>{metaRecord.Method || "N/A"}</div>
//             </div>

//             <Divider style={{ margin: "8px 0" }} />

//             <div>
//               <Text type="secondary">Release Date</Text>
//               <div style={{ marginTop: 4 }}>
//                 {metaRecord.Release_Date || "N/A"}
//               </div>
//             </div>

//             <Divider style={{ margin: "8px 0" }} />

//             <div>
//               <Text type="secondary">Keywords</Text>
//               <div style={{ marginTop: 4, wordBreak: "break-word" }}>
//                 {metaRecord.Keywords || "N/A"}
//               </div>
//             </div>

//             <Divider style={{ margin: "8px 0" }} />
//           </Space>
//         )}
//       </Card>
//     </div>
//   );
// };

// export default PdbPage;

import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";

import { useParams } from "react-router-dom";
import {
  Card,
  Spin,
  Typography,
  Tag,
  Space,
  Divider,
  Row,
  Col,
  Button,
  Descriptions,
  Flex,
  message,
} from "antd";

const { Title, Text } = Typography;

const PdbPage = () => {
  const { pdbId } = useParams(); // e.g. "1akg_a"
  const pdbIdUpper = useMemo(() => String(pdbId || "").toUpperCase(), [pdbId]);

  const containerRef = useRef(null);
  const appletRef = useRef(null);

  const [viewMode, setViewMode] = useState("cartoon"); // "cartoon" | "stick"

  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [metaRecord, setMetaRecord] = useState(null);

  const runJsmol = (cmd) => {
    try {
      if (!window.Jmol || !appletRef.current) return;
      window.Jmol.script(appletRef.current, cmd);
    } catch {
      // ignore
    }
  };

  // 1) Create JSmol ONCE per pdbId
  useEffect(() => {
    if (!window.Jmol) {
      message.error(
        "JSmol not loaded. Check /public/jsmol and index.html script tag."
      );
      return;
    }
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const Info = {
      width: "100%",
      height: 520,
      use: "HTML5",
      j2sPath: "/jsmol/j2s",
      serverURL: "https://chemapps.stolaf.edu/jmol/jsmol/php/jsmol.php",
      script: `
        load "/api/pdb/file/${pdbId}";
        set antialiasDisplay true;
        set cartoonFancy true;
        cartoon only;
        color structure;
      `,
    };

    const applet = window.Jmol.getApplet("jsmolApplet", Info);
    appletRef.current = applet;
    containerRef.current.innerHTML = window.Jmol.getAppletHtml(applet);

    // reset view button default on new PDB
    setViewMode("cartoon");
  }, [pdbId]);

  // 2) Toggle view WITHOUT recreating viewer
  useEffect(() => {
    if (!appletRef.current) return;

    if (viewMode === "stick") {
      // stick view
      runJsmol(
        "select all; cartoons off; spacefill off; wireframe 0.2; color cpk;"
      );
    } else {
      // cartoon view
      runJsmol("select all; cartoons only; color structure;");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const handleToggleView = () => {
    setViewMode((prev) => (prev === "cartoon" ? "stick" : "cartoon"));
  };

  // Metadata from backend (same EC2 host)
  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setMetaLoading(true);
      setMetaError(null);
      setMetaRecord(null);

      try {
        const res = await fetch(`/api/meta/${pdbId}`);
        if (!res.ok) {
          if (res.status === 404) return;
          throw new Error(`Metadata fetch failed: ${res.status}`);
        }
        const obj = await res.json();
        if (!cancelled) setMetaRecord(obj);
      } catch (e) {
        if (!cancelled) setMetaError(e.message || "Failed to load metadata");
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    if (pdbId) loadMeta();
    return () => {
      cancelled = true;
    };
  }, [pdbId]);

  const handleSimilarityClick = (threshold) => {
    const baseId = pdbId.split("_")[0].toLowerCase();
    // Page 3 later
    // navigate(`/percent/${baseId}/${threshold}`);
    console.log("Go to similarity", baseId, threshold);
  };

  return (
    <div style={{ padding: 16 }}>
      {/* HEADER */}
      <Header />

      <Divider style={{ margin: "12px 0" }} />

      {/* TITLE + ACTIONS (KEEP EXACTLY YOUR LAYOUT) */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
        <Title level={2} style={{ margin: 0 }}>
          {pdbId.toUpperCase()} Structure Viewer
        </Title>

        <Space wrap>
          <Text strong>Cluster of similarity:</Text>

          <Button.Group>
            <Button onClick={() => handleSimilarityClick(50)}>50%</Button>
            <Button onClick={() => handleSimilarityClick(65)}>65%</Button>
            <Button onClick={() => handleSimilarityClick(75)}>75%</Button>
          </Button.Group>

          <Button
            type="primary"
            href={`https://www.rcsb.org/structure/${pdbId
              .split("_")[0]
              .toUpperCase()}`}
            target="_blank"
          >
            View on RCSB
          </Button>
        </Space>

        {/* CYCLIZATION CLASS (KEEP EXACTLY YOUR LAYOUT) */}
        <Flex align="center" gap={8} style={{ marginLeft: "auto" }}>
          <Text strong>Cyclization Class:</Text>

          <Button.Group>
            <Button>s2s</Button>
            <Button>s2e</Button>
            <Button>e2e</Button>
            <Button>e2e + s2s</Button>
            <Button>s2e + s2s</Button>
          </Button.Group>
        </Flex>
      </Flex>

      <Divider />

      {/* MAIN CONTENT */}
      <Row gutter={[16, 16]} align="stretch">
        {/* LEFT: JSmol */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Title level={4} style={{ margin: 0 }}>
                  PDB Viewer: {pdbIdUpper}
                </Title>
                <Button onClick={handleToggleView}>
                  Switch to {viewMode === "cartoon" ? "Stick" : "Cartoon"}
                </Button>
              </Space>
            }
            style={{
              borderRadius: 14,
              boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
              height: 640,
            }}
            bodyStyle={{
              padding: 12,
              height: 584,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              ref={containerRef}
              style={{
                flex: 1,
                minHeight: 520,
                width: "100%",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            />
          </Card>
        </Col>

        {/* RIGHT: Metadata */}
        <Col xs={24} lg={8}>
          <Card
            title={<Text strong>Metadata</Text>}
            style={{
              borderRadius: 14,
              boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
              height: 640,
            }}
            bodyStyle={{
              padding: 16,
              height: 584,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {metaLoading ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Spin />
              </div>
            ) : metaError ? (
              <Text type="danger">{metaError}</Text>
            ) : !metaRecord ? (
              <Text type="secondary">No metadata found for {pdbIdUpper}</Text>
            ) : (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Space
                  direction="vertical"
                  size="middle"
                  style={{ width: "100%" }}
                >
                  <div>
                    <Text type="secondary">Cyclization</Text>
                    <div style={{ marginTop: 6 }}>
                      <Tag
                        color="blue"
                        style={{ borderRadius: 999, padding: "2px 10px" }}
                      >
                        {metaRecord.Cyclization || "Unknown"}
                      </Tag>
                    </div>
                  </div>

                  <Divider style={{ margin: "8px 0" }} />

                  <Descriptions
                    size="small"
                    column={1}
                    colon={false}
                    labelStyle={{ width: 120, color: "rgba(0,0,0,0.55)" }}
                    contentStyle={{ color: "rgba(0,0,0,0.88)" }}
                  >
                    <Descriptions.Item label="Organism">
                      {metaRecord.Organism_Scientific_Name || "N/A"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Method">
                      {metaRecord.Method || "N/A"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Release Date">
                      {metaRecord.Release_Date || "N/A"}
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider style={{ margin: "8px 0" }} />

                  <div>
                    <Text type="secondary">Keywords</Text>
                    <div style={{ marginTop: 6, wordBreak: "break-word" }}>
                      {metaRecord.Keywords || "N/A"}
                    </div>
                  </div>

                  <Divider style={{ margin: "8px 0" }} />

                  <div>
                    <Text type="secondary">Sequence</Text>
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                        background: "rgba(0,0,0,0.03)",
                        border: "1px solid rgba(0,0,0,0.06)",
                        borderRadius: 10,
                        padding: 10,
                        wordBreak: "break-word",
                      }}
                    >
                      {metaRecord.Sequence || "N/A"}
                    </div>
                  </div>
                </Space>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PdbPage;
