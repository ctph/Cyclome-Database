import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Table,
  Typography,
  Spin,
  Space,
  Button,
  Tag,
  message,
} from "antd";
import Header from "../components/Header";

const { Title, Text } = Typography;

const SimilarityPage = () => {
  const { pdbId, threshold } = useParams();
  const navigate = useNavigate();

  const baseId = useMemo(
    () =>
      String(pdbId || "")
        .toLowerCase()
        .split("_")[0],
    [pdbId]
  );
  const t = useMemo(() => String(threshold || "50"), [threshold]);

  // similarity
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  // sequence
  const [seqLoading, setSeqLoading] = useState(true);
  const [sequence, setSequence] = useState("");
  const [seqError, setSeqError] = useState("");

  // fetch similarity list
  useEffect(() => {
    let cancelled = false;

    async function loadSimilarity() {
      setLoading(true);
      try {
        const res = await fetch(`/api/similarity/${baseId}/${t}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();

        const list = Array.isArray(data.results) ? data.results : [];
        const mapped = list.map((id, idx) => ({
          key: `${id}-${idx}`,
          rank: idx + 1,
          pdb: id,
        }));

        if (!cancelled) setRows(mapped);
      } catch (e) {
        if (!cancelled)
          message.error(e.message || "Failed to load similarity results");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (baseId) loadSimilarity();
    return () => {
      cancelled = true;
    };
  }, [baseId, t]);

  // fetch sequence
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setSeqLoading(true);
      setSeqError("");
      setSequence("");
      setRows([]);

      try {
        const res = await fetch(`/api/similarity/${baseId}/${t}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();

        const seq = String(data?.Sequence ?? "");
        const simKey = `similarity_${t}`;
        const simRaw = String(data?.[simKey] ?? "");

        // Split by comma or semicolon, trim, remove empties, de-dupe
        const ids = Array.from(
          new Set(
            simRaw
              .split(/[;,]/)
              .map((s) => s.trim())
              .filter(Boolean)
          )
        );

        const mapped = ids.map((id, idx) => ({
          key: `${id}-${idx}`,
          rank: idx + 1,
          pdb: id,
          sequence: seq, // ✅ same sequence for all rows
        }));

        if (!cancelled) {
          setSequence(seq);
          setRows(mapped);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e?.message || "Failed to load";
          message.error(msg);
          setSeqError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSeqLoading(false);
        }
      }
    }

    if (baseId) load();
    return () => {
      cancelled = true;
    };
  }, [baseId, t]);

  const columns = [
    { title: "#", dataIndex: "rank", width: 70 },
    {
      title: "Similar PDB",
      dataIndex: "pdb",
      render: (v) => (
        <Text style={{ fontFamily: "monospace" }}>
          {String(v).toUpperCase()}
        </Text>
      ),
    },
    {
      title: "Sequence",
      dataIndex: "sequence",
      ellipsis: true,
      render: (seq) => (
        <Text style={{ fontFamily: "monospace" }}>
          {seq ? String(seq) : "—"}
        </Text>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 140,
      render: (_, record) => (
        <Button
          type="primary"
          onClick={() => navigate(`/pdb/${String(record.pdb).toLowerCase()}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Header />

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space align="center">
          <Title level={2} style={{ margin: 0 }}>
            Similarity: {baseId.toUpperCase()}
          </Title>
          <Tag color="blue">{t}%</Tag>
        </Space>

        {/* ✅ Sequence card */}
        <Card
          title="Sequence"
          style={{ borderRadius: 14, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}
          bodyStyle={{ padding: 12 }}
        >
          {seqLoading ? (
            <div
              style={{
                height: 140,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Spin />
            </div>
          ) : seqError ? (
            <Text type="danger">{seqError}</Text>
          ) : sequence ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "monospace",
                maxHeight: 220,
                overflow: "auto",
                padding: 10,
                borderRadius: 10,
                background: "#fafafa",
                border: "1px solid #f0f0f0",
              }}
            >
              {sequence}
            </pre>
          ) : (
            <Text type="secondary">No sequence found.</Text>
          )}
        </Card>

        {/* Similarity table card */}
        <Card
          style={{ borderRadius: 14, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}
          bodyStyle={{ padding: 12 }}
        >
          {loading ? (
            <div
              style={{
                height: 320,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Spin />
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 25, showSizeChanger: true }}
            />
          )}
        </Card>
      </Space>
    </div>
  );
};

export default SimilarityPage;
