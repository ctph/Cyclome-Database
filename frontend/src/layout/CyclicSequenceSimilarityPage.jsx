import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import Header from "../components/Header";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const FLASK_API_BASE = process.env.REACT_APP_FLASK_API_BASE || "http://localhost:5002";
const GITHUB_URL =
  process.env.REACT_APP_CYCLIC_GITHUB_URL || "https://github.com/ctph/Cyclome-Database";

function normalizeBatchRows(rawText) {
  return String(rawText || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("\t").map((part) => part.trim());
      if (parts.length < 2) {
        throw new Error(
          `Line ${index + 1} must include at least query_sequence and template_sequence separated by tabs.`
        );
      }

      return {
        query_sequence: parts[0],
        template_sequence: parts[1],
        template_cyclization: parts[2] || "",
      };
    });
}

export default function CyclicSequenceSimilarityPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [singleResult, setSingleResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState("");

  const batchColumns = useMemo(
    () => [
      {
        title: "#",
        dataIndex: "index",
        key: "index",
        width: 70,
        render: (value) => value + 1,
      },
      {
        title: "Query",
        dataIndex: ["result", "query_sequence"],
        key: "query_sequence",
        render: (value) => <Text code>{value}</Text>,
      },
      {
        title: "Topology",
        dataIndex: ["result", "topology_class"],
        key: "topology_class",
        render: (value) => <Tag color="blue">{value}</Tag>,
      },
      {
        title: "Score",
        dataIndex: ["result", "best_alignment_score"],
        key: "best_alignment_score",
      },
      {
        title: "Similarity %",
        dataIndex: ["result", "best_similarity_percent"],
        key: "best_similarity_percent",
      },
      {
        title: "Identity %",
        dataIndex: ["result", "best_identity_percent"],
        key: "best_identity_percent",
      },
    ],
    []
  );

  const handleSubmit = async (values) => {
    setLoading(true);
    setError("");
    setSingleResult(null);
    setBatchResult(null);

    try {
      const payload = batchMode
        ? {
            items: normalizeBatchRows(values.batch_rows).map((item) => ({
              ...item,
              match_score: Number(values.match_score ?? 2),
              mismatch_score: Number(values.mismatch_score ?? -1),
              gap_penalty: Number(values.gap_penalty ?? -2),
            })),
          }
        : {
            query_sequence: values.query_sequence,
            template_sequence: values.template_sequence,
            template_cyclization: values.template_cyclization || "",
            match_score: Number(values.match_score ?? 2),
            mismatch_score: Number(values.mismatch_score ?? -1),
            gap_penalty: Number(values.gap_penalty ?? -2),
          };

      const endpoint = batchMode
        ? `${FLASK_API_BASE}/api/similarity/cyclic-sequence/batch`
        : `${FLASK_API_BASE}/api/similarity/cyclic-sequence`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok && response.status !== 207) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      if (batchMode) {
        setBatchResult(data);
        if (data?.error_count) {
          message.warning(`Batch finished with ${data.error_count} error(s).`);
        } else {
          message.success("Batch similarity run completed.");
        }
      } else {
        setSingleResult(data);
        message.success("Cyclic sequence similarity run completed.");
      }
    } catch (err) {
      const msg = err?.message || "Failed to run cyclic sequence similarity.";
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Header />

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card style={{ borderRadius: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                Cyclic Sequence Similarity
              </Title>
              <Paragraph style={{ maxWidth: 920, marginBottom: 0 }}>
                Run cyclicity-aware sequence similarity directly from the site. Paste a
                query sequence, template sequence, and cyclization topology, then inspect
                the best alignment, topology class, and scoring output.
              </Paragraph>
            </div>

            <Space wrap>
              <Button type={!batchMode ? "primary" : "default"} onClick={() => setBatchMode(false)}>
                Single Run
              </Button>
              <Button type={batchMode ? "primary" : "default"} onClick={() => setBatchMode(true)}>
                Batch Run
              </Button>
              <Button type="primary" htmlType="submit" form="cyclic-seq-form" loading={loading}>
                Run
              </Button>
              <Button href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                GitHub
              </Button>
            </Space>

            <Alert
              type="info"
              showIcon
              message={
                batchMode
                  ? "Batch mode: one row per line. Separate values with real tab characters in this order: query sequence, template sequence, cyclization. The third value is optional."
                  : "Single mode sends one cyclic similarity request to the Flask backend."
              }
              description={
                batchMode
                  ? "Example row: ACDEFG, then ACDFGG, then 1-6, 2-4 in three tab-separated columns. If you paste from a spreadsheet, the tabs usually come through automatically."
                  : null
              }
            />

            <Form
              id="cyclic-seq-form"
              form={form}
              layout="vertical"
              initialValues={{
                match_score: 2,
                mismatch_score: -1,
                gap_penalty: -2,
                template_cyclization: "",
              }}
              onFinish={handleSubmit}
            >
              {!batchMode ? (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Query Sequence"
                      name="query_sequence"
                      rules={[{ required: true, message: "Please enter a query sequence" }]}
                    >
                      <TextArea rows={4} placeholder="e.g. ACDEFG" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Template Sequence"
                      name="template_sequence"
                      rules={[{ required: true, message: "Please enter a template sequence" }]}
                    >
                      <TextArea rows={4} placeholder="e.g. ACDFGG" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item label="Template Cyclization" name="template_cyclization">
                      <Input placeholder="e.g. 1-6, 2-4" />
                    </Form.Item>
                  </Col>
                </Row>
              ) : (
                <Form.Item
                  label="Batch Input"
                  name="batch_rows"
                  rules={[{ required: true, message: "Please paste at least one batch row" }]}
                >
                  <TextArea
                    rows={10}
                    placeholder={[
                      "ACDEFG    ACDFGG    1-6, 2-4",
                      "AAAA    AAAB",
                    ].join("\n")}
                  />
                </Form.Item>
              )}

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="Match Score" name="match_score">
                    <Input type="number" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Mismatch Score" name="mismatch_score">
                    <Input type="number" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Gap Penalty" name="gap_penalty">
                    <Input type="number" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Space>
        </Card>

        {error ? <Alert type="error" showIcon message={error} /> : null}

        {singleResult ? (
          <Card title="Run Result" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Space wrap>
                <Tag color="blue">{singleResult.topology_class}</Tag>
                <Tag>Score: {singleResult.best_alignment_score}</Tag>
                <Tag>Similarity: {singleResult.best_similarity_percent}%</Tag>
                <Tag>Identity: {singleResult.best_identity_percent}%</Tag>
              </Space>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card size="small" title="Inputs">
                    <Space direction="vertical" size={6}>
                      <Text><strong>Query:</strong> <Text code>{singleResult.query_sequence}</Text></Text>
                      <Text><strong>Template:</strong> <Text code>{singleResult.template_sequence}</Text></Text>
                      <Text>
                        <strong>Cyclization:</strong>{" "}
                        <Text code>
                          {singleResult.template_cyclization?.length
                            ? JSON.stringify(singleResult.template_cyclization)
                            : "[]"}
                        </Text>
                      </Text>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card size="small" title="Best Template Selection">
                    <Space direction="vertical" size={6}>
                      <Text>
                        <strong>Best template used:</strong>{" "}
                        <Text code>{singleResult.best_template_used}</Text>
                      </Text>
                      <Text>
                        <strong>Candidate templates:</strong>{" "}
                        <Text code>{singleResult.candidate_templates?.join(" | ")}</Text>
                      </Text>
                    </Space>
                  </Card>
                </Col>
              </Row>

              <Divider style={{ margin: 0 }} />

              <Card size="small" title="Best Alignment">
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
{singleResult.aligned_query}
{singleResult.match_line}
{singleResult.aligned_template}
                </pre>
              </Card>
            </Space>
          </Card>
        ) : null}

        {batchResult ? (
          <Card title="Batch Results" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Space wrap>
                <Tag>Total: {batchResult.count}</Tag>
                <Tag color="green">Success: {batchResult.success_count}</Tag>
                <Tag color={batchResult.error_count ? "red" : "default"}>
                  Errors: {batchResult.error_count}
                </Tag>
              </Space>

              <Table
                rowKey={(record) => `result-${record.index}`}
                columns={batchColumns}
                dataSource={batchResult.results || []}
                pagination={{ pageSize: 10 }}
              />

              {batchResult.errors?.length ? (
                <Card size="small" title="Batch Errors">
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {batchResult.errors.map((err) => (
                      <Alert
                        key={`error-${err.index}`}
                        type="error"
                        showIcon
                        message={`Row ${err.index + 1}: ${err.error}`}
                      />
                    ))}
                  </Space>
                </Card>
              ) : null}
            </Space>
          </Card>
        ) : null}
      </Space>
    </div>
  );
}
