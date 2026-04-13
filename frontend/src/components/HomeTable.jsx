import React, { useEffect, useMemo, useState } from "react";
import { Space, Table, Tag } from "antd";
import { Link } from "react-router-dom";
import { ORIGINAL_PDB_CHAIN_IDS } from "../generated/originalPdbs";

const API_BASE = process.env.REACT_APP_API_BASE || "";

const HomeTable = () => {
  const [rawMap, setRawMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/home_page_table_with_filenames.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load homepage JSON");
        return res.json();
      })
      .then((data) => {
        setRawMap(data || {});
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

      const entry = seqMap.get(sequence);
      const filenames = Array.isArray(info.filenames)
        ? info.filenames
        : info.filename
          ? [info.filename]
          : [];

      filenames
        .map((pdb) => String(pdb || "").trim())
        .filter(Boolean)
        .forEach((pdb) => {
          const chainId = pdb
            .toLowerCase()
            .replace(/\.pdb$/i, "")
            .trim();
          if (!chainId) return;

          entry.pdbs.set(chainId, {
            baseId,
            chainId,
            isOriginal: ORIGINAL_PDB_CHAIN_IDS.has(chainId),
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
  }, [rawMap]);

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
    // const innerColumns = [
    //   {
    //     title: "PDB ID",
    //     dataIndex: "chainId",
    //     key: "chainId",
    //     render: (id) => (
    //       <Link to={`/pdb/${id}`}>
    //         <Tag color="blue">{id}</Tag>
    //       </Link>
    //     ),
    //   },
    const innerColumns = [
      {
        title: "PDB ID",
        dataIndex: "chainId",
        key: "chainId",
        render: (id) => {
          const displayId = String(id || "").split("_")[0];
          return (
            <Link to={`/pdb/${id}`}>
              <Tag color="blue">{displayId}</Tag>
            </Link>
          );
        },
      },

      {
        title: "Actions",
        key: "actions",
        render: (_, row) =>
          row.isOriginal ? (
            <Space>
              <Link to={`/pdb/${row.chainId}`}>View 3D</Link>
              <a href={row.downloadUrl} download>
                Download
              </a>
            </Space>
          ) : (
            <a
              href={`https://www.rcsb.org/structure/${String(row.baseId || "").toUpperCase()}`}
              target="_blank"
              rel="noreferrer"
            >
              View on RCSB
            </a>
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
