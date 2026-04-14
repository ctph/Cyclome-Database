// frontend/src/PdbPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import MeltingTempHistogram from "../components/MeltingTempHistogram";

import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Spin,
  Typography,
  Divider,
  Row,
  Col,
  Button,
  Descriptions,
  Flex,
  message,
} from "antd";

const { Title, Text } = Typography;

function normalizeCyclization(x) {
  return String(x || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\+/g, "+");
}

const CYC_BUTTONS = [
  { key: "s2s", label: "s2s" },
  { key: "s2e", label: "s2e" },
  { key: "e2e", label: "e2e" },
  { key: "e2e+s2s", label: "e2e + s2s" },
  { key: "s2e+s2s", label: "s2e + s2s" },
];

async function loadAllMeltTemps() {
  const res = await fetch("/home_page_table_with_filenames.json");
  if (!res.ok) throw new Error(`home_page_table fetch failed: ${res.status}`);
  const data = await res.json();

  const allTemps = [];
  const tempMap = {};

  for (const [key, entry] of Object.entries(data || {})) {
    const raw = entry?.melting_point_K;
    if (raw == null || raw === "") continue;
    const val = parseFloat(raw);
    if (isNaN(val)) continue;

    // index by base id lowercase e.g. "2kcg"
    tempMap[key.trim().toLowerCase()] = val;
    // also index every chain filename e.g. "2kcg_a"
    for (const filename of entry?.filenames || []) {
      const chainKey = String(filename)
        .replace(/\.pdb$/i, "")
        .toLowerCase();
      if (chainKey) tempMap[chainKey] = val;
    }

    allTemps.push(val);
  }

  return { allTemps, tempMap };
}

const PdbPage = () => {
  const { pdbId } = useParams();
  const pdbIdUpper = useMemo(() => String(pdbId || "").toUpperCase(), [pdbId]);

  const containerRef = useRef(null);
  const appletRef = useRef(null);

  const [viewMode, setViewMode] = useState("cartoon");

  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [metaRecord, setMetaRecord] = useState(null);
  const navigate = useNavigate();

  // melting temp state
  const [allTemps, setAllTemps] = useState([]);
  const [tempMap, setTempMap] = useState({});
  const [tempsLoaded, setTempsLoaded] = useState(false);

  useEffect(() => {
    loadAllMeltTemps()
      .then(({ allTemps, tempMap }) => {
        setAllTemps(allTemps);
        setTempMap(tempMap);
      })
      .catch((e) => console.warn("Failed to load melt temps:", e))
      .finally(() => setTempsLoaded(true));
  }, []);

  // resolve protein's temp:
  const thisTemp = useMemo(() => {
    if (metaRecord?.STop2Melt_K != null && metaRecord.STop2Melt_K !== "") {
      const v = parseFloat(metaRecord.STop2Melt_K);
      if (!isNaN(v)) return v;
    }
    const key = String(pdbId || "").toLowerCase();
    return tempMap[key] ?? null;
  }, [metaRecord, pdbId, tempMap]);

  const runJsmol = (cmd) => {
    try {
      if (!window.Jmol || !appletRef.current) return;
      window.Jmol.script(appletRef.current, cmd);
    } catch {}
  };

  useEffect(() => {
    if (!window.Jmol) {
      message.error(
        "JSmol not loaded. Check /public/jsmol and index.html script tag.",
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

    setViewMode("cartoon");
  }, [pdbId]);

  useEffect(() => {
    if (!appletRef.current) return;

    if (viewMode === "stick") {
      runJsmol(
        "select all; cartoons off; spacefill off; wireframe 0.2; color cpk;",
      );
    } else {
      runJsmol("select all; cartoons only; color structure;");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Metadata from backend
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

  const normalizedBaseId = useMemo(
    () =>
      String(pdbId || "")
        .trim()
        .toLowerCase()
        .replace(/\.pdb$/i, "")
        .split("_")[0]
        .trim(),
    [pdbId],
  );

  const handleSimilarityClick = (threshold) => {
    if (!normalizedBaseId) return;
    navigate(`/similarity/${normalizedBaseId}/${threshold}`);
  };

  const baseId = normalizedBaseId;

  const activeCycl = useMemo(() => {
    return normalizeCyclization(metaRecord?.Cyclization);
  }, [metaRecord]);

  const handleCyclizationClick = (cyclKey) => {
    navigate(`/cyclization/${baseId}/${cyclKey}`);
  };

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <Header />

        <Divider style={{ margin: "12px 0 20px" }} />

        <Flex direction="column" gap={10} style={{ marginBottom: 18 }}>
          <Flex align="center" gap={16} wrap="wrap">
            <div style={{ flex: 1, minWidth: 260 }}>
              <Title level={2} style={{ margin: 0 }}>
                {pdbIdUpper.split("_")[0]} Structure Viewer
              </Title>
            </div>

            <div style={{ flex: "none" }}>
              <Flex align="center" gap={8} wrap="wrap" justify="flex-end">
                <Text strong>Similarity:</Text>

                <Button.Group>
                  <Button onClick={() => handleSimilarityClick(50)}>50%</Button>
                  <Button onClick={() => handleSimilarityClick(65)}>65%</Button>
                  <Button onClick={() => handleSimilarityClick(75)}>75%</Button>
                </Button.Group>

                <Button
                  type="primary"
                  href={`https://www.rcsb.org/structure/${String(pdbId || "")
                    .split("_")[0]
                    .toUpperCase()}`}
                  target="_blank"
                >
                  View on RCSB
                </Button>
              </Flex>
            </div>
          </Flex>

          <Flex align="center" gap={16} wrap="wrap">
            <div style={{ flex: 1, minWidth: 260 }}>
              <Flex align="center" gap={8} wrap="wrap">
                <Text strong>Viewer:</Text>

                <Button.Group>
                  <Button
                    type={viewMode === "cartoon" ? "primary" : "default"}
                    onClick={() =>
                      viewMode !== "cartoon" && setViewMode("cartoon")
                    }
                  >
                    Cartoon
                  </Button>
                  <Button
                    type={viewMode === "stick" ? "primary" : "default"}
                    onClick={() => viewMode !== "stick" && setViewMode("stick")}
                  >
                    Stick
                  </Button>
                </Button.Group>
              </Flex>
            </div>

            <div style={{ flex: "none" }}>
              <Flex align="center" gap={8} wrap="wrap" justify="flex-end">
                <Text strong>Cyclization:</Text>

                <Button.Group>
                  {CYC_BUTTONS.map((b) => {
                    const isActive =
                      Boolean(activeCycl) && activeCycl === b.key;
                    return (
                      <Button
                        key={b.key}
                        type={isActive ? "primary" : "default"}
                        disabled={!isActive}
                        onClick={() =>
                          isActive && handleCyclizationClick(b.key)
                        }
                      >
                        {b.label}
                      </Button>
                    );
                  })}
                </Button.Group>
              </Flex>
            </div>
          </Flex>
        </Flex>

        <Row gutter={[18, 18]} justify="center" align="stretch">
          <Col xs={24} lg={14}>
            <Card
              style={{
                borderRadius: 14,
                boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                height: 560,
              }}
              bodyStyle={{
                padding: 12,
                height: 560,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                ref={containerRef}
                style={{
                  flex: 1,
                  width: "100%",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card
              title={<Text strong>Structure Information</Text>}
              style={{
                borderRadius: 14,
                boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                height: 560,
              }}
              bodyStyle={{
                padding: 16,
                height: 504,
                overflowY: "auto",
              }}
            >
              {metaLoading ? (
                <div
                  style={{
                    height: "100%",
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
                <>
                  <Descriptions
                    size="small"
                    column={1}
                    colon={false}
                    labelStyle={{ width: 120, color: "rgba(0,0,0,0.55)" }}
                    contentStyle={{ color: "rgba(0,0,0,0.88)" }}
                  >
                    <Descriptions.Item label="Title">
                      {metaRecord.Title || "N/A"}
                    </Descriptions.Item>

                    <Descriptions.Item label="Method">
                      {metaRecord.Method || "N/A"}
                    </Descriptions.Item>

                    <Descriptions.Item label="Released">
                      {metaRecord.Release_Date || "N/A"}
                    </Descriptions.Item>

                    <Descriptions.Item label="Organism">
                      {metaRecord.Organism_Scientific_Name || "N/A"}
                    </Descriptions.Item>

                    <Descriptions.Item label="Classification">
                      {metaRecord.Keywords || "N/A"}
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider style={{ margin: "12px 0" }} />

                  <Text type="secondary">Sequence</Text>
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: 12,
                      background: "rgba(0,0,0,0.0303)",
                      border: "1px solid rgba(0,0,0,0.06)",
                      borderRadius: 10,
                      padding: 10,
                      wordBreak: "break-word",
                    }}
                  >
                    {metaRecord.Sequence || "N/A"}
                  </div>
                  {/* ── Melting Temperature Histogram ── */}
                  <Divider style={{ margin: "12px 0" }} />

                  {tempsLoaded ? (
                    <MeltingTempHistogram
                      allTemps={allTemps}
                      thisTemp={thisTemp}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "12px 0",
                      }}
                    >
                      <Spin size="small" />
                    </div>
                  )}
                </>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default PdbPage;
