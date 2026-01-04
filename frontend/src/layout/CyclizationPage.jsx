import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Table, Typography, Space, Button, Tag, message } from "antd";
import Header from "../components/Header";

const { Title, Text } = Typography;

function normalizeBaseId(x) {
  return String(x || "")
    .trim()
    .toLowerCase()
    .replace(/\.pdb$/i, "")
    .split("_")[0];
}

function normalizeChainId(x) {
  return String(x || "")
    .trim()
    .toLowerCase()
    .replace(/\.pdb$/i, "");
}

const LABEL_BY_KEY = {
  s2s: "s2s",
  s2e: "s2e",
  e2e: "e2e",
  "e2e+s2s": "e2e + s2s",
  "s2e+s2s": "s2e + s2s",
};

const CyclizationPage = () => {
  const { pdbId, cyclization } = useParams();
  const navigate = useNavigate();

  const baseId = useMemo(() => normalizeBaseId(pdbId), [pdbId]);
  const cyclKey = useMemo(() => String(cyclization || "").trim().toLowerCase(), [cyclization]);

  const [seqByBase, setSeqByBase] = useState({});
  const [loading, setLoading] = useState(true);
  const [seqLoading, setSeqLoading] = useState(true);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setSeqLoading(true);
      try {
        const res = await fetch("/home_page_table_with_filenames.json");
        const data = await res.json().catch(() => null);

        const map = {};
        for (const [k, info] of Object.entries(data || {})) {
          const base = String(k || "").trim().toLowerCase();
          const seq = String(info?.sequence || "").trim().toUpperCase();
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

  useEffect(() => {
    if (!cyclKey) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setResults([]);
      setCount(0);

      try {
        const url = `/api/meta/cyclization/${encodeURIComponent(cyclKey)}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = data?.error || data?.detail || `Request failed (${res.status})`;
          throw new Error(msg);
        }

        const arr = Array.isArray(data?.results) ? data.results : [];
        const cleaned = arr.map((x) => normalizeChainId(x)).filter(Boolean);

        if (!cancelled) {
          setResults(cleaned);
          setCount(Number(data?.count ?? cleaned.length));
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(e?.message || "Failed to load cyclization results");
          message.error(e?.message || "Failed to load cyclization results");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [cyclKey]);

  const dataSource = useMemo(() => {
    return results.map((chainId, i) => {
      const base = normalizeBaseId(chainId);
      const seq = seqByBase[base] || "";
      return {
        key: chainId,
        idx: i + 1,
        chainId,
        base,
        sequence: seq || "-",
      };
    });
  }, [results, seqByBase]);

  const columns = [
    {
      title: "#",
      dataIndex: "idx",
      key: "idx",
      width: 70,
    },
    {
      title: "PDB ID",
      dataIndex: "chainId",
      key: "chainId",
      render: (v) => <Tag color="blue">{v}</Tag>,
      width: 180,
    },
    {
      title: "Sequence",
      dataIndex: "sequence",
      key: "sequence",
      render: (seq) => (
        <span style={{ fontFamily: "monospace" }}>
          {String(seq || "").slice(0, 60)}
          {String(seq || "").length > 60 ? "..." : ""}
        </span>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 140,
      render: (_, row) => (
        <Button type="primary" onClick={() => navigate(`/pdb/${row.chainId}`)}>
          View
        </Button>
      ),
    },
  ];

  const label = LABEL_BY_KEY[cyclKey] || cyclKey || "N/A";

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Header />

        <Card style={{ marginTop: 16 }}>
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Title level={2} style={{ margin: 0 }}>
              Cyclization: {label}
              {count ? (
                <Text style={{ marginLeft: 10, fontSize: 14 }} type="secondary">
                  {count} results
                </Text>
              ) : null}
            </Title>

            <Space wrap>
              <Button onClick={() => navigate(`/pdb/${baseId}_a`)}>
                Back to {baseId.toUpperCase()}
              </Button>
            </Space>

            <Table
              columns={columns}
              dataSource={dataSource}
              loading={loading || seqLoading}
              pagination={{ pageSize: 25 }}
            />
            {error ? <Text type="danger">{error}</Text> : null}
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default CyclizationPage;

