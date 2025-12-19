import React, { useState, useEffect } from "react";
import { Table, Tag } from "antd";
import { Link } from "react-router-dom";

const PdbTable = () => {
  const [pdbs, setPdbs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/home_page_table_with_filenames.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load JSON");
        return res.json();
      })
      .then((data) => {
        const formatted = Object.entries(data)
          .map(([pdbId, info]) => {
            const chainId = String(info.filename || "")
              .toLowerCase()
              .replace(/\.pdb$/i, ""); // "1ag7_a"

            return {
              id: chainId,
              baseId: pdbId,
              sequence: info.sequence || "-",
              melting_point: info.melting_point_K ?? "-",
              filepath: `./backend/cyclic_pdbs/${info.filename}`,
            };
          })
          .sort((a, b) =>
            a.id.localeCompare(b.id, undefined, { numeric: true })
          );

        setPdbs(formatted);
        setLoading(false);
      });
  }, []);

  const columns = [
    {
      title: "PDB ID",
      dataIndex: "id",
      key: "id",
      render: (chainId) => (
        <Link to={`/pdb/${chainId}`}>
          <Tag color="blue">{chainId}</Tag>
        </Link>
      ),
    },
    {
      title: "PDB Sequence",
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
      title: "CyMelt (K)",
      dataIndex: "melting_point",
      key: "melting_point",
      render: (temp) => <span>{temp !== "-" ? `${temp} K` : "-"}</span>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <>
          <Link to={`/pdb/${record.id}`} style={{ marginRight: 8 }}>
            View 3D
          </Link>
          <a href={record.filepath} download>
            Download
          </a>
        </>
      ),
    },
  ];

  return (
    <div style={{ marginLeft: "20px", marginRight: "20px" }}>
      <Table
        columns={columns}
        dataSource={pdbs}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default PdbTable;
