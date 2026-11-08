// frontend/src/PdbPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import DistortionTempHistogram from "../components/DistortionTempHistogram";
import CoordinationSitePanel from "../components/CoordinationSitePanel";
import { clearCoordinationScript, coordinationScript } from "../lib/coordinationView";

import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  Alert,
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

async function loadAllDistortionTemps() {
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
  const loadedSourceRef = useRef("");
  const previousSiteRef = useRef("");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const viewMode = ["stick", "coordination"].includes(requestedView) ? requestedView : "cartoon";
  const setViewMode = (mode) => setSearchParams((previous) => {
    const next = new URLSearchParams(previous);
    next.set("view", mode);
    return next;
  });
  const [coordinationData, setCoordinationData] = useState(null);
  const [coordinationPending, setCoordinationPending] = useState(null);
  const [coordinationError, setCoordinationError] = useState("");
  const [coordinationLoading, setCoordinationLoading] = useState(false);
  const [selectedSite, setSelectedSite] = useState("all");
  const [showDistances, setShowDistances] = useState(true);
  const [showResidueLabels, setShowResidueLabels] = useState(true);

  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [metaRecord, setMetaRecord] = useState(null);
  const navigate = useNavigate();

  // Predicted distortion temperature, using the existing Kelvin data fields.
  const [allTemps, setAllTemps] = useState([]);
  const [tempMap, setTempMap] = useState({});
  const [tempsLoaded, setTempsLoaded] = useState(false);

  useEffect(() => {
    loadAllDistortionTemps()
      .then(({ allTemps, tempMap }) => {
        setAllTemps(allTemps);
        setTempMap(tempMap);
      })
      .catch((e) => console.warn("Failed to load distortion temperatures:", e))
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

  useEffect(() => {
    const controller = new AbortController();
    const root = `${process.env.PUBLIC_URL || ""}/data/cyclometal/sites/collection`;
    setCoordinationData(null);
    setCoordinationPending(null);
    setCoordinationError("");
    setCoordinationLoading(true);
    setSelectedSite("all");
    fetch(`${root}/summary.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Coordination annotation index is unavailable.");
        return response.json();
      })
      .then(async (summary) => {
        const structure = pdbIdUpper.replace(/\.PDB$/, "");
        if (!controller.signal.aborted) setCoordinationPending(summary.pendingStructures[structure] || null);
        if (!summary.structures[structure]) return null;
        const response = await fetch(`${root}/${structure}.json`, { signal: controller.signal });
        if (!response.ok) throw new Error("The supplied coordination annotation could not be loaded.");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setCoordinationData(data);
          setSelectedSite(data?.sites?.[0]?.id || "all");
        }
      })
      .catch((error) => { if (error.name !== "AbortError") setCoordinationError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCoordinationLoading(false); });
    return () => controller.abort();
  }, [pdbIdUpper]);

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
        load ${JSON.stringify(`/api/pdb/file/${encodeURIComponent(pdbId)}`)};
        set antialiasDisplay true;
        set cartoonFancy true;
        cartoon only;
        color structure;
      `,
    };

    // React owns the document; JSmol must return markup instead of document.write().
    window.Jmol.setDocument(0);
    const applet = window.Jmol.getApplet("jsmolApplet", Info);
    appletRef.current = applet;
    containerRef.current.innerHTML = window.Jmol.getAppletHtml(applet);
    loadedSourceRef.current = `/api/pdb/file/${encodeURIComponent(pdbId)}`;
    previousSiteRef.current = "";
    return () => {
      if (typeof window.Jmol._destroy === "function") window.Jmol._destroy(applet);
      if (appletRef.current === applet) appletRef.current = null;
    };
  }, [pdbId]);

  useEffect(() => {
    if (!appletRef.current) return;

    if (viewMode === "coordination") {
      if (!coordinationData || coordinationData.structure !== pdbIdUpper.replace(/\.PDB$/, "")) return;
      const source = `${process.env.PUBLIC_URL || ""}${coordinationData.pdbUrl}`;
      const loadModel = loadedSourceRef.current !== source;
      try {
        runJsmol(coordinationScript(coordinationData, {
          siteId: selectedSite, showDistances, showLabels: showResidueLabels,
          loadModel, focus: loadModel || previousSiteRef.current !== selectedSite,
        }));
        loadedSourceRef.current = source;
        previousSiteRef.current = selectedSite;
      } catch (error) {
        setCoordinationError(error.message);
      }
      return;
    }
    const source = `/api/pdb/file/${encodeURIComponent(pdbId)}`;
    const load = loadedSourceRef.current === source ? "" : `load ${JSON.stringify(source)};`;
    runJsmol(`${load}${clearCoordinationScript}${viewMode === "stick"
      ? "select all; cartoons OFF; spacefill OFF; wireframe 0.2; color cpk;"
      : "select all; cartoons ONLY; color structure;"}`);
    loadedSourceRef.current = source;
    previousSiteRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdbId, pdbIdUpper, viewMode, coordinationData, selectedSite, showDistances, showResidueLabels]);

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

  const normalizedPdbId = useMemo(
    () =>
      String(pdbId || "")
        .trim()
        .toLowerCase()
        .replace(/\.pdb$/i, "")
        .trim(),
    [pdbId],
  );

  const handleSimilarityClick = (threshold) => {
    if (!normalizedPdbId) return;
    navigate(`/similarity/${normalizedPdbId}/${threshold}`);
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

        <Flex vertical gap={10} style={{ marginBottom: 18 }}>
          <Flex align="center" gap={16} wrap="wrap">
            <div style={{ flex: 1, minWidth: 260 }}>
              <Title level={2} style={{ margin: 0 }}>
                {pdbIdUpper.split("_")[0]} Structure Viewer
              </Title>
            </div>

            <div style={{ flex: "none", maxWidth: "100%" }}>
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
                  {coordinationData && <Button type={viewMode === "coordination" ? "primary" : "default"} onClick={() => setViewMode("coordination")}>Metal sites</Button>}
                </Button.Group>
              </Flex>
            </div>

            <div style={{ flex: "none", maxWidth: "100%" }}>
              <Flex align="center" gap={8} wrap="wrap" justify="flex-end">
                <Text strong>Cyclization:</Text>

                <Button.Group style={{ flexWrap: "wrap", maxWidth: "100%" }}>
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
                  {/* Predicted Distortion Temperature histogram */}
                  <Divider style={{ margin: "12px 0" }} />

                  {tempsLoaded ? (
                    <DistortionTempHistogram
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
        {coordinationLoading && viewMode === "coordination" ? <Spin style={{ marginTop: 18 }} /> : null}
        {coordinationError ? <Alert style={{ marginTop: 18 }} type="warning" showIcon message={coordinationError} /> : null}
        {coordinationPending && <Alert style={{ marginTop: 18 }} type="info" showIcon message="Coordination sites awaiting conformer curation"
          description={<><p>The supplied donor selectors match multiple alternate conformers. No conformer has been chosen and interactive site annotations are held pending curation.</p><p>{coordinationPending.reason}</p><Button href={`${process.env.PUBLIC_URL || ""}${coordinationPending.pdbUrl}`} download>Download supplied PDB</Button>{" "}<Button href={`${process.env.PUBLIC_URL || ""}${coordinationPending.scriptUrl}`} download>Download supplied Jmol script</Button></>} />}
        {!coordinationLoading && !coordinationData && !coordinationPending && viewMode === "coordination" && !coordinationError
          ? <Alert style={{ marginTop: 18 }} type="info" message="No curated coordination annotations have been supplied for this structure." /> : null}
        {coordinationData && <CoordinationSitePanel annotation={coordinationData} active={viewMode === "coordination"}
          siteId={selectedSite} showDistances={showDistances} showLabels={showResidueLabels}
          onOpen={() => setViewMode("coordination")} onSiteChange={setSelectedSite}
          onDistancesChange={setShowDistances} onLabelsChange={setShowResidueLabels} />}
      </div>
    </div>
  );
};

export default PdbPage;
