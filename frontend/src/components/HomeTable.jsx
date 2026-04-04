import React, { useEffect, useMemo, useState } from "react";
import { Table, Tag } from "antd";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

const HomeTable = () => {
  const [rawMap, setRawMap] = useState({});
  const [metadataRows, setMetadataRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/home_page_table_with_filenames.json").then((res) => {
        if (!res.ok) throw new Error("Failed to load homepage JSON");
        return res.json();
      }),
      fetch("/static/cyclome_for_website_with_metadata.json").then((res) => {
        if (!res.ok) throw new Error("Failed to load metadata JSON");
        return res.json();
      }),
    ])
      .then(([homeData, metadataData]) => {
        setRawMap(homeData || {});
        setMetadataRows(Array.isArray(metadataData) ? metadataData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const groupedRows = useMemo(() => {
    const seqMap = new Map();

    Object.entries(rawMap).forEach(([baseId, info]) => {
      const sequence = String(info.sequence || "").trim();
      if (!sequence) return;

      if (!seqMap.has(sequence)) {
        seqMap.set(sequence, {
          key: sequence,
          sequence,
          melting_point: info.melting_point_K ?? "-",
          pdbs: new Map(),
        });
      }

      const chainId = String(info.filename || "")
        .toLowerCase()
        .replace(/\.pdb$/i, "")
        .trim();

      if (chainId) {
        seqMap.get(sequence).pdbs.set(chainId, {
          baseId,
          chainId,
          downloadUrl: `${API_BASE}/api/pdb/file/${chainId}`,
        });
      }
    });

    metadataRows.forEach((row) => {
      const sequence = String(row.Sequence || "").trim();
      if (!sequence) return;

      if (!seqMap.has(sequence)) {
        seqMap.set(sequence, {
          key: sequence,
          sequence,
          melting_point:
            row.STop2Melt_K ??
            row.Melting_point_K ??
            row.CyMelt_K ??
            row["CyMelt (K)"] ??
            "-",
          pdbs: new Map(),
        });
      }

      const entry = seqMap.get(sequence);
      if (entry.melting_point === "-") {
        entry.melting_point =
          row.STop2Melt_K ??
          row.Melting_point_K ??
          row.CyMelt_K ??
          row["CyMelt (K)"] ??
          "-";
      }

      String(row.PDB || "")
        .split(";")
        .map((pdb) => pdb.trim())
        .filter(Boolean)
        .forEach((pdb) => {
          const chainId = pdb.toLowerCase().replace(/\.pdb$/i, "").trim();
          if (!chainId) return;

          entry.pdbs.set(chainId, {
            baseId: chainId.split("_")[0].toUpperCase(),
            chainId,
            downloadUrl: `${API_BASE}/api/pdb/file/${chainId}`,
          });
        });
    });

    return Array.from(seqMap.values()).map((entry) => ({
      ...entry,
      pdbs: Array.from(entry.pdbs.values()).sort((a, b) =>
        a.chainId.localeCompare(b.chainId, undefined, { numeric: true }),
      ),
    }));
  }, [rawMap, metadataRows]);

  const columns = [
    {
      title: "Sequence",
      dataIndex: "sequence",
      key: "sequence",
      render: (seq) => (
        <span style={{ fontFamily: "monospace" }}>
          {seq.slice(0, 40)}
          {seq.length > 40 ? "..." : ""}
        </span>
      ),
    },
    {
      title: "PDB Structures",
      key: "structures",
      render: (_, record) => record.pdbs.length,
    },
    {
      title: "CyMelt (K)",
      dataIndex: "melting_point",
      key: "melting_point",
      render: (temp) => (temp !== "-" ? `${temp} K` : "-"),
    },
  ];

  const expandedRowRender = (record) => {
    const innerColumns = [
      {
        title: "PDB ID",
        dataIndex: "chainId",
        key: "chainId",
        render: (id) => (
          <Link to={`/pdb/${id}`}>
            <Tag color="blue">{id}</Tag>
          </Link>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        render: (_, row) => (
          <>
            <Link to={`/pdb/${row.chainId}`} style={{ marginRight: 8 }}>
              View 3D
            </Link>
            <a href={row.downloadUrl} download>
              Download
            </a>
          </>
        ),
      },
    ];

    return (
      <Table
        columns={innerColumns}
        dataSource={record.pdbs.map((p) => ({
          key: p.chainId,
          ...p,
        }))}
        pagination={false}
        size="small"
      />
    );
  };

  return (
    <div style={{ marginLeft: 20, marginRight: 20 }}>
      <Table
        loading={loading}
        columns={columns}
        dataSource={groupedRows}
        expandable={{ expandedRowRender }}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default HomeTable;
