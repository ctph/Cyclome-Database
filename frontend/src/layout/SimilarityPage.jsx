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

function normalizeBaseId(x) {
  return String(x || "")
    .trim()
    .toLowerCase()
    .replace(/\.pdb$/i, "")
    .split("_")[0];
}

const SimilarityPage = () => {
  const { pdbId, threshold } = useParams();
  const navigate = useNavigate();

  const baseId = useMemo(() => normalizeBaseId(pdbId), [pdbId]);

  // match backend expectation (ideally integer thresholds)
  const t = useMemo(() => {
    const raw = String(threshold || "50").trim();
    return /^\d+$/.test(raw) ? raw : "50";
  }, [threshold]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!baseId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setResults([]);
      setCount(0);

      try {
        const url = `/api/similarity/${encodeURIComponent(
          baseId
        )}/${encodeURIComponent(t)}`;
        const res = await fetch(url);

        // if backend returns JSON error body, surface it
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            data?.error || data?.detail || `Request failed (${res.status})`;
          throw new Error(msg);
        }

        // Expected: { pdbId, threshold, key, count, results: [] }
        const arr = Array.isArray(data?.results) ? data.results : [];
        const cleaned = arr
          .map((x) => normalizeBaseId(x))
          .filter(Boolean)
          .filter((x) => x !== baseId);

        if (!cancelled) {
          setResults(cleaned);
          setCount(Number(data?.count ?? cleaned.length));
        }
      } catch (e) {
        const msg = e?.message || "Failed to load similarity results";
        if (!cancelled) {
          setError(msg);
          message.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [baseId, t]);

  const rows = useMemo(
    () =>
      results.map((id, idx) => ({
        key: `${id}-${idx}`,
        rank: idx + 1,
        pdbId: id,
      })),
    [results]
  );

  async function goToPdbChain(base) {
    const baseKey = normalizeBaseId(base);
    if (!baseKey) return;

    try {
      const res = await fetch(`/api/pdb/${encodeURIComponent(baseKey)}`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error || `Failed to fetch chains (${res.status})`;
        throw new Error(msg);
      }

      const chainIds = Array.isArray(data?.chainIds) ? data.chainIds : [];
      if (chainIds.length === 0)
        throw new Error("No chains found for this PDB");

      // Prefer *_a if exists, else first
      const lower = chainIds.map((x) => String(x).toLowerCase());
      const preferred = lower.find((x) => x.endsWith("_a")) || lower[0];

      navigate(`/pdb/${preferred}`);
    } catch (e) {
      const msg = e?.message || "Failed to open PDB viewer";
      message.error(msg);
    }
  }

  const columns = useMemo(
    () => [
      { title: "#", dataIndex: "rank", width: 80 },
      {
        title: "Similar PDB",
        dataIndex: "pdbId",
        render: (v) => (
          <Text style={{ fontFamily: "monospace" }}>
            {String(v).toUpperCase()}
          </Text>
        ),
      },
      {
        title: "Action",
        key: "action",
        width: 160,
        render: (_, r) => (
          <Button type="primary" onClick={() => goToPdbChain(r.pdbId)}>
            View
          </Button>
        ),
      },
    ],
    [navigate]
  );

  return (
    <div style={{ padding: 16 }}>
      <Header />

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space align="center" wrap>
          <Title level={2} style={{ margin: 0 }}>
            Similarity: {baseId ? baseId.toUpperCase() : "—"}
          </Title>
          <Tag color="blue">{t}%</Tag>
          {!loading && !error && <Tag>{count} results</Tag>}
        </Space>

        <Card style={{ borderRadius: 14 }}>
          {loading ? (
            <div
              style={{
                height: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Spin />
            </div>
          ) : error ? (
            <Text type="danger">{error}</Text>
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
