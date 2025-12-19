import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";

import { useParams, useNavigate } from "react-router-dom";
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
  const { pdbId } = useParams();
  const pdbIdUpper = useMemo(() => String(pdbId || "").toUpperCase(), [pdbId]);

  const containerRef = useRef(null);
  const appletRef = useRef(null);

  const [viewMode, setViewMode] = useState("cartoon"); // "cartoon" | "stick"

  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [metaRecord, setMetaRecord] = useState(null);
  const navigate = useNavigate();

  const runJsmol = (cmd) => {
    try {
      if (!window.Jmol || !appletRef.current) return;
      window.Jmol.script(appletRef.current, cmd);
    } catch {}
  };

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

    setViewMode("cartoon");
  }, [pdbId]);

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

  const handleSimilarityClick = (threshold) => {
    const baseId = pdbId.split("_")[0].toLowerCase();
    navigate(`/similarity/${baseId}/${threshold}`);
  };

  return (
    <div style={{ padding: 24 }}>
      {/* ✅ Page container: centralized like your example */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <Header />

        <Divider style={{ margin: "12px 0 20px" }} />

        {/* Controls layout */}
        <Flex direction="column" gap={10} style={{ marginBottom: 18 }}>
          {/* Row 1 */}
          <Flex align="center" gap={16} wrap="wrap">
            {/* Left: Title */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <Title level={2} style={{ margin: 0 }}>
                {pdbId.toUpperCase()} Structure Viewer
              </Title>
            </div>

            {/* Right: Similarity */}
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
                  href={`https://www.rcsb.org/structure/${pdbId
                    .split("_")[0]
                    .toUpperCase()}`}
                  target="_blank"
                >
                  View on RCSB
                </Button>
              </Flex>
            </div>
          </Flex>

          {/* Row 2 */}
          <Flex align="center" gap={16} wrap="wrap">
            {/* Left: Viewer */}
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

            {/* Right: Cyclization */}
            <div style={{ flex: "none" }}>
              <Flex align="center" gap={8} wrap="wrap" justify="flex-end">
                <Text strong>Cyclization:</Text>

                <Button.Group>
                  <Button>s2s</Button>
                  <Button>s2e</Button>
                  <Button>e2e</Button>
                  <Button>e2e + s2s</Button>
                  <Button>s2e + s2s</Button>
                </Button.Group>
              </Flex>
            </div>
          </Flex>
        </Flex>

        {/* Two-card layout centered inside the container */}
        <Row gutter={[18, 18]} justify="center" align="stretch">
          {/* left: Viewer */}
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

          {/* right: Metadata */}
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
                height: 504, // 560 - title area approx
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
                <Text type="secondary">
                  No metadata found for {pdbId.toUpperCase()}
                </Text>
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
                      background: "rgba(0,0,0,0.03)",
                      border: "1px solid rgba(0,0,0,0.06)",
                      borderRadius: 10,
                      padding: 10,
                      wordBreak: "break-word",
                    }}
                  >
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
