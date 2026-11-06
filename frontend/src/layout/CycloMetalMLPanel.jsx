import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Select, Space, Table, Tag, Typography } from "antd";

const { Title, Paragraph, Text } = Typography;
const dataRoot = `${process.env.PUBLIC_URL || ""}/data/cyclometal`;

export default function CycloMetalMLPanel() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [predictedClass, setPredictedClass] = useState("");
  const [cyclization, setCyclization] = useState("");
  const [page, setPage] = useState(1);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(`${dataRoot}/ml-predictions.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The CycloMetal-ML predictions could not be loaded.");
        return response.json();
      })
      .then(setCatalog)
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [requestKey]);

  const filteredRows = useMemo(() => (catalog?.rows || []).filter((row) => (
    row.structure.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!predictedClass || row.predicted === predictedClass) &&
    (!cyclization || row.cyclization === cyclization)
  )), [catalog, query, predictedClass, cyclization]);
  const cyclizations = useMemo(() => [...new Set((catalog?.rows || []).map((row) => row.cyclization))].sort(), [catalog]);

  const columns = useMemo(() => [
    { title: "Cyclome-PDB", dataIndex: "structure", key: "structure", fixed: "left", width: 145,
      render: (value) => <Text code>{value}</Text> },
    { title: "Cyclization", dataIndex: "cyclization", key: "cyclization", width: 140 },
    ...(catalog?.classes || []).map((name) => ({
      title: name, key: name, width: 110, align: "right",
      onCell: (row) => ({ className: row.predicted === name ? "cyclometal-ml-predicted-cell" : "" }),
      render: (_, row) => <span className="cyclometal-ml-probability">{row.predicted === name ? "✓ " : ""}{row.probabilities[name]}</span>,
    })),
    { title: "Predicted", dataIndex: "predicted", key: "predicted", width: 120,
      render: (value) => <Tag color="green">{value}</Tag> },
    { title: "Confidence", dataIndex: "confidence", key: "confidence", width: 140, align: "right",
      sorter: (a, b) => Number(a.confidence) - Number(b.confidence) },
  ], [catalog]);

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="cyclometal-panel">
      <Card>
        <Title level={3}>{catalog?.heading || "CycloMetal-ML predicted metal-binding class by sequence and topology"}</Title>
        {catalog && <Paragraph>{catalog.note}</Paragraph>}
        {catalog && <Paragraph type="secondary">{catalog.statistics.predictions.toLocaleString()} supplied predictions · {catalog.statistics.structures.toLocaleString()} structures · {catalog.statistics.classes} metal classes</Paragraph>}
        <Button href={`${dataRoot}/CycloMetal-ML-predictions.html`} download>Download supplied ML predictions HTML</Button>
      </Card>

      {error ? <Alert type="error" showIcon message={error} action={<Button onClick={() => setRequestKey((value) => value + 1)}>Retry</Button>} /> : null}

      <Card title="Supplied ML class probabilities" loading={!catalog && !error}>
        <div className="cyclometal-filters">
          <Input allowClear aria-label="Search ML structure" placeholder="Search structure, e.g. 1A1P_A" value={query} onChange={(event) => changeFilter(setQuery, event.target.value)} />
          <Select allowClear aria-label="Filter predicted class" placeholder="All predicted classes" value={predictedClass || undefined} options={(catalog?.classes || []).map((name) => ({ value: name, label: name }))} onChange={(value) => changeFilter(setPredictedClass, value || "")} />
          <Select allowClear aria-label="Filter cyclization" placeholder="All cyclizations" value={cyclization || undefined} options={cyclizations.map((value) => ({ value, label: value || "Not specified" }))} onChange={(value) => changeFilter(setCyclization, value || "")} />
        </div>
        <Space wrap className="cyclometal-filter-actions">
          <Button onClick={() => { setQuery(""); setPredictedClass(""); setCyclization(""); setPage(1); }}>Reset ML filters</Button>
          <Text type="secondary">{filteredRows.length.toLocaleString()} predictions shown</Text>
        </Space>
        <Table rowKey={(row) => `${row.structure}:${row.cyclization}`} columns={columns} dataSource={filteredRows} pagination={{ current: page, defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100], onChange: setPage, showTotal: (total) => `${total.toLocaleString()} predictions` }} scroll={{ x: "max-content", y: 560 }} />
        <Paragraph type="secondary">Values and predicted-class highlights reproduce the supplied HTML, including its displayed precision.</Paragraph>
      </Card>
    </div>
  );
}
