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

  const t = useMemo(() => {
    const raw = String(threshold || "50").trim();
    return /^\d+$/.test(raw) ? raw : "50";
  }, [threshold]);

  const [loading, setLoading] = useState(true);
  const [seqLoading, setSeqLoading] = useState(true);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);

  // Static sequence map from public JSON:
  // { "1a1p": "SEQUENCE...", ... }
  const [seqByBase, setSeqByBase] = useState({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setSeqLoading(true);
      try {
        const res = await fetch("/home_page_table_with_filenames.json");
        const data = await res.json().catch(() => null);

        const map = {};
        for (const [k, info] of Object.entries(data || {})) {
          const base = String(k || "")
            .trim()
            .toLowerCase();
          const seq = String(info?.sequence || "")
            .trim()
            .toUpperCase();
          if (base && seq) map[base] = seq;
        }

        if (!cancelled) setSeqByBase(map);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSeqByBase({});
      } finally {
        if (!cancelled) setSeqLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load similarity list (keep your current routing + action behavior)
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
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            data?.error || data?.detail || `Request failed (${res.status})`;
          throw new Error(msg);
        }

        const arr = Array.isArray(data?.results) ? data.results : [];
        const cleaned = arr
          .map((x) => normalizeBaseId(x))
          .filter(Boolean)
          .filter((x) => x !== baseId);

        if (!cancelled) {
          setResults(cleaned);
          setCount(Number(data?.count ?? cleaned.length));
        }

        // Merge into existing seqByBase, don't overwrite
        try {
          const seqRes = await fetch("/api/pdb/sequences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: cleaned }),
          });

          const seqData = await seqRes.json().catch(() => null);

          if (!cancelled && seqRes.ok) {
            const map = {};
            for (const r of seqData?.results || []) {
              const id = String(r.id || "")
                .trim()
                .toLowerCase();
              const seq = String(r.sequence || "")
                .trim()
                .toUpperCase();
              if (id && seq) map[id] = seq;
            }

            setSeqByBase((prev) => ({ ...prev, ...map }));
          }
        } catch {
          // ignore batch failures
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

  // View -> resolve base -> preferred chain -> /pdb/<chain>
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

      const lower = chainIds.map((x) => String(x).toLowerCase());
      const preferred = lower.find((x) => x.endsWith("_a")) || lower[0];

      navigate(`/pdb/${preferred}`);
    } catch (e) {
      const msg = e?.message || "Failed to open PDB viewer";
      message.error(msg);
    }
  }

  const rows = useMemo(() => {
    return results.map((id, idx) => {
      const seq = seqByBase[id] || "-";
      return {
        key: `${id}-${idx}`,
        rank: idx + 1,
        pdbId: id,
        sequence: seq,
      };
    });
  }, [results, seqByBase]);

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
        title: "Sequence",
        dataIndex: "sequence",
        render: (seq) =>
          seq === "-" ? (
            <Text type="secondary">-</Text>
          ) : (
            <Text style={{ fontFamily: "monospace" }}>
              {String(seq).slice(0, 32)}
              {String(seq).length > 32 ? "…" : ""}
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
    [goToPdbChain]
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
          {seqLoading && <Tag>Loading sequences…</Tag>}
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
              rowKey="key"
              pagination={{ pageSize: 25, showSizeChanger: true }}
            />
          )}
        </Card>
      </Space>
    </div>
  );
};

export default SimilarityPage;
