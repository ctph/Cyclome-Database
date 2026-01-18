// frontend/src/PdbPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";

import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Spin,
  Typography,
  Divider,
  Row,
  Col,
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

const PdbPage = () => {
  const { pdbId } = useParams();
  const pdbIdUpper = useMemo(() => String(pdbId || "").toUpperCase(), [pdbId]);

  const containerRef = useRef(null);
  const appletRef = useRef(null);

  const [viewMode, setViewMode] = useState("cartoon");

  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [metaRecord, setMetaRecord] = useState(null);
  const [viewerStatus, setViewerStatus] = useState("loading");

  const navigate = useNavigate();

  const runJsmol = (cmd) => {
    try {
      if (!window.Jmol || !appletRef.current) return;
      window.Jmol.script(appletRef.current, cmd);
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;

    async function initViewer() {
      setViewerStatus("loading");

      if (!window.Jmol) {
        message.error(
          "JSmol not loaded. Check /public/jsmol and index.html script tag."
        );
        setViewerStatus("unavailable");
        return;
      }

      try {
        const res = await fetch(`/api/pdb/file/${pdbId}`, { method: "HEAD" });

        if (!res.ok) {
          setViewerStatus("unavailable");
          return;
        }

        if (cancelled) return;

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
        containerRef.current.innerHTML =
          window.Jmol.getAppletHtml(applet);

        setViewMode("cartoon");
        setViewerStatus("ready");
      } catch {
        setViewerStatus("unavailable");
      }
    }

    if (pdbId) initViewer();

    return () => {
      cancelled = true;
    };
  }, [pdbId]);

  // View mode switching (only if viewer is ready)
  useEffect(() => {
    if (viewerStatus !== "ready") return;
    if (!appletRef.current) return;

    if (viewMode === "stick") {
      runJsmol(
        "select all; cartoons off; spacefill off; wireframe 0.2; color cpk;"
      );
    } else {
      runJsmol("select all; cartoons only; color structure;");
    }
  }, [viewMode, viewerStatus]);
 
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
    navigate(`/similarity/${baseId}/${threshold}`);
  };

  const baseId = useMemo(
    () => String(pdbId || "").split("_")[0].toLowerCase(),
    [pdbId]
  );

  const activeCycl = useMemo(() => {
    return normalizeCyclization(metaRecord?.Cyclization);
  }, [metaRecord]);

  const handleCyclizationClick = (cyclKey) => {
    navigate(`/cyclization/${baseId}/${cyclKey}`);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Header />

        <Divider style={{ margin: "12px 0 20px" }} />

        <Flex direction="column" gap={10} style={{ marginBottom: 18 }}>
          <Title level={2} style={{ margin: 0 }}>
            {pdbIdUpper} Structure Viewer
          </Title>
        </Flex>

        <Row gutter={[18, 18]} justify="center" align="stretch">
          <Col xs={24} lg={14}>
            <Card
              style={{ borderRadius: 14, height: 560 }}
              bodyStyle={{
                padding: 12,
                height: 560,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {viewerStatus === "loading" && <Spin />}

              {viewerStatus === "unavailable" && (
                <Text type="secondary">
                  This structure is not available locally.
                </Text>
              )}

              <div
                ref={containerRef}
                style={{
                  display: viewerStatus === "ready" ? "block" : "none",
                  width: "100%",
                  height: "100%",
                }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Structure Information" style={{ height: 560 }}>
              {metaLoading ? (
                <Spin />
              ) : metaError ? (
                <Text type="danger">{metaError}</Text>
              ) : !metaRecord ? (
                <Text type="secondary">No metadata found</Text>
              ) : (
                <>
                  <Descriptions size="small" column={1} colon={false}>
                    <Descriptions.Item label="Title">
                      {metaRecord.Title || "N/A"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Method">
                      {metaRecord.Method || "N/A"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Released">
                      {metaRecord.Release_Date || "N/A"}
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider />

                  <Text type="secondary">Sequence</Text>
                  <div style={{ fontFamily: "monospace", fontSize: 12 }}>
                    {metaRecord.Sequence || "N/A"}
                  </div>
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
