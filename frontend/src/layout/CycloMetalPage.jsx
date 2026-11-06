import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Input, Select, Space, Table, Typography } from "antd";
import Header from "../components/Header";
import "./CycloMetalPage.css";

const { Title, Paragraph, Text } = Typography;
const dataRoot = `${process.env.PUBLIC_URL || ""}/data/cyclometal`;

export default function CycloMetalPage() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [metal, setMetal] = useState("");
  const [shape, setShape] = useState("");
  const [onlyHits, setOnlyHits] = useState(false);
  const [page, setPage] = useState(1);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "CycloMetal | Cyclome";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(`${dataRoot}/catalog.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The CycloMetal catalog could not be loaded.");
        return response.json();
      })
      .then(setCatalog)
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [requestKey]);

  const geometries = useMemo(() => new Map((catalog?.geometries || []).map((item) => [item.shape_name, item])), [catalog]);
  const visibleMetals = useMemo(() => metal ? [metal] : catalog?.metals || [], [catalog, metal]);
  const filteredRows = useMemo(() => (catalog?.rows || []).filter((row) => {
    if (!row.structure.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (!metal && !shape && !onlyHits) return true;
    return visibleMetals.some((name) => row.cells[name].some((hit) => !shape || hit.shape === shape));
  }), [catalog, query, metal, shape, onlyHits, visibleMetals]);

  const columns = useMemo(() => [
    { title: "Structure", dataIndex: "structure", key: "structure", fixed: "left", width: 135,
      render: (value) => <Text code>{value}</Text> },
    ...visibleMetals.map((name) => ({
      title: name, key: name, width: 160,
      render: (_, row) => {
        const hits = row.cells[name].filter((hit) => !shape || hit.shape === shape);
        if (!hits.length) return <span className="cyclometal-no-hit" aria-label={`No supplied hit for ${row.structure}, ${name}`}>❌</span>;
        return <div className="cyclometal-hits">{hits.map((hit, index) => (
          <details key={`${hit.shape}-${index}`} className="cyclometal-hit">
            <summary aria-label={`${hit.shape} hit details for ${row.structure}, ${name}`} title={geometries.get(hit.shape)?.description}>
              <code>{hit.shape}</code>
            </summary>
            <div className="cyclometal-hit-details">
              <strong>{geometries.get(hit.shape)?.description}</strong>
              <span>{hit.details}</span>
            </div>
          </details>
        ))}</div>;
      },
    })),
  ], [visibleMetals, shape, geometries]);

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="cyclometal-page">
      <Header />
      <main className="cyclometal-content">
        <Card>
          <Title level={2}>CycloMetal</Title>
          <Paragraph>Browse the supplied cyclic-peptide metal-coordination geometry hits. Expand a geometry code to inspect its residues and RMSD; the legend below explains each code.</Paragraph>
          {catalog && <Paragraph type="secondary">{catalog.statistics.structures.toLocaleString()} structures · {catalog.statistics.metals} metals · {catalog.statistics.geometries} legend entries</Paragraph>}
          <Space wrap>
            <Button href={`${dataRoot}/cyclome-metal-hits.html`} download>Download supplied HTML</Button>
            <Button href={`${dataRoot}/shape_names.csv`} download>Download geometry legend CSV</Button>
            <a href="#metalpdb-legend">Jump to geometry legend</a>
          </Space>
        </Card>

        {error ? <Alert type="error" showIcon message={error} action={<Button onClick={() => setRequestKey((value) => value + 1)}>Retry</Button>} /> : null}

        <Card title={catalog?.heading || "Cyclic metal-shape hits"} loading={!catalog && !error}>
          <div className="cyclometal-filters">
            <Input allowClear aria-label="Search structure" placeholder="Search structure, e.g. 1AS5_A" value={query} onChange={(event) => changeFilter(setQuery, event.target.value)} />
            <Select allowClear aria-label="Filter metal" placeholder="All metals" value={metal || undefined} options={(catalog?.metals || []).map((name) => ({ value: name, label: name }))} onChange={(value) => changeFilter(setMetal, value || "")} />
            <Select allowClear showSearch optionFilterProp="label" aria-label="Filter geometry" placeholder="All geometries" value={shape || undefined} options={(catalog?.geometries || []).map((item) => ({ value: item.shape_name, label: `${item.shape_name} — ${item.description}` }))} onChange={(value) => changeFilter(setShape, value || "")} />
          </div>
          <Space wrap className="cyclometal-filter-actions">
            <Checkbox checked={onlyHits} onChange={(event) => changeFilter(setOnlyHits, event.target.checked)}>Show structures with hits only</Checkbox>
            <Button onClick={() => { setQuery(""); setMetal(""); setShape(""); setOnlyHits(false); setPage(1); }}>Reset filters</Button>
            <Text type="secondary">{filteredRows.length.toLocaleString()} structures shown</Text>
          </Space>
          <Table className="cyclometal-matrix" rowKey="structure" columns={columns} dataSource={filteredRows} pagination={{ current: page, defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100], onChange: (value) => setPage(value), showTotal: (total) => `${total.toLocaleString()} structures` }} scroll={{ x: "max-content", y: 560 }} />
          <Paragraph type="secondary">❌ means no hit is listed in the supplied matrix for that structure and metal. Residue labels and RMSD values are reproduced from the supplied file.</Paragraph>
        </Card>

        <section id="metalpdb-legend" aria-labelledby="metalpdb-legend-title">
          <Card>
            <Title level={3} id="metalpdb-legend-title">Metal-coordination geometries from MetalPDB</Title>
            <Table rowKey="shape_name" dataSource={catalog?.geometries || []} pagination={false} size="small" scroll={{ x: 600 }} columns={[
              { title: "Shape code", dataIndex: "shape_name", width: 130, render: (value) => <Text code>{value}</Text> },
              { title: "Geometry", dataIndex: "description" },
              { title: "Coordination number", dataIndex: "coord_number", width: 170 },
            ]} />
          </Card>
        </section>
      </main>
    </div>
  );
}
