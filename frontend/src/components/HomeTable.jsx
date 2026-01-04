import React, { useEffect, useMemo, useState } from "react";
import { Table, Tag, Tooltip } from "antd";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

const HomeTable = () => {
  const [rawMap, setRawMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/home_page_table_with_filenames.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load JSON");
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

  /**
   * Group entries by sequence
   */
  const groupedRows = useMemo(() => {
    const seqMap = new Map();

    Object.entries(rawMap).forEach(([baseId, info]) => {
      const sequence = info.sequence;
      if (!sequence) return;

      if (!seqMap.has(sequence)) {
        seqMap.set(sequence, {
          key: sequence,
          sequence,
          melting_point: info.melting_point_K ?? "-",
          pdbs: []
        });
      }

      const chainId = String(info.filename || "")
        .toLowerCase()
        .replace(/\.pdb$/i, "");

      seqMap.get(sequence).pdbs.push({
        baseId,
        chainId,
        downloadUrl: `${API_BASE}/api/pdb/file/${chainId}`
      });
    });

    return Array.from(seqMap.values());
  }, [rawMap]);

  const columns = [
    {
      title: "Sequence",
      dataIndex: "sequence",
      key: "sequence",
      render: (seq) => (
        <span style={{ fontFamily: "monospace" }}>
          {seq.slice(0, 40)}
          {seq.length > 40 ? "…" : ""}
        </span>
      )
    },
    {
      title: "PDB Structures",
      key: "structures",
      align: "center",
      render: (_, record) => record.pdbs.length
    },
    {
      title: "CyMelt (K)",
      dataIndex: "melting_point",
      key: "melting_point",
      align: "center",
      render: (temp) => (temp !== "-" ? `${temp} K` : "-")
    }
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
        )
      },
      {
        title: "Actions",
        key: "actions",
        render: (_, row) => (
          <>
            <Link to={`/pdb/${row.chainId}`} style={{ marginRight: 12 }}>
              View 3D
            </Link>
            <a href={row.downloadUrl} download>
              Download
            </a>
          </>
        )
      }
    ];

    return (
      <Table
        columns={innerColumns}
        dataSource={record.pdbs.map((p) => ({
          key: p.chainId,
          ...p
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
        rowKey="key"
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender,
          rowExpandable: (record) => record.pdbs.length > 1,
          expandIcon: ({ expanded, onExpand, record }) =>
            record.pdbs.length > 1 ? (
              <Tooltip title="Multiple PDB structures share this sequence">
                <span
                  onClick={(e) => onExpand(record, e)}
                  style={{
                    cursor: "pointer",
                    marginRight: 8,
                    fontSize: 16
                  }}
                >
                  {expanded ? "−" : "+"}
                </span>
              </Tooltip>
            ) : null
        }}
      />
    </div>
  );
};

export default HomeTable;
