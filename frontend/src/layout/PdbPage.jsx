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
    <div style={{ padding: 16 }}>
      {/* header */}
      <Header />

      <Divider style={{ margin: "12px 0" }} />

      {/* title and action */}
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

        {/* cycliczation button */}
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

      {/*main content */}
      <Row gutter={[16, 16]} align="stretch">
        {/* left: JSmol */}
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

        {/* right: Metadata */}
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
