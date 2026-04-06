import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
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

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

function normalizeBatchRows(rawText) {
  return String(rawText || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("\t").map((part) => part.trim());
      if (parts.length < 1 || !parts[0]) {
        throw new Error(`Line ${index + 1} must include a sequence in the first tab-separated column.`);
      }

      return {
        sequence: parts[0],
        cyclization_pattern: parts[1] || "",
      };
    });
}

export default function Stop2MeltPage() {
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
        dataIndex: "_rowIndex",
        key: "_rowIndex",
        width: 70,
        render: (value) => value + 1,
      },
      {
        title: "Sequence",
        dataIndex: "sequence",
        key: "sequence",
        render: (value) => <Text code>{value}</Text>,
      },
      {
        title: "Cyclization",
        dataIndex: "cyclization_pattern",
        key: "cyclization_pattern",
        render: (value) => <Text code>{value || ""}</Text>,
      },
      {
        title: "Predicted Stop2Melt",
        dataIndex: "pred_stop2melt",
        key: "pred_stop2melt",
        render: (value) => (value == null ? "-" : Number(value).toFixed(6)),
      },
      {
        title: "Error",
        dataIndex: "error",
        key: "error",
        render: (value) => (value ? <Tag color="red">{value}</Tag> : null),
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
        ? { items: normalizeBatchRows(values.batch_rows) }
        : {
            sequence: values.sequence,
            cyclization_pattern: values.cyclization_pattern || "",
          };

      const endpoint = batchMode
        ? "/api/similarity/stop2melt/batch"
        : "/api/similarity/stop2melt";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      if (batchMode) {
        const results = (data?.results || []).map((item, index) => ({
          ...item,
          _rowIndex: index,
        }));
        setBatchResult({ ...data, results });

        const errorCount = results.filter((item) => item.error).length;
        if (errorCount > 0) {
          message.warning(`Batch finished with ${errorCount} error(s).`);
        } else {
          message.success("Stop2Melt batch run completed.");
        }
      } else {
        setSingleResult(data);
        message.success("Stop2Melt prediction completed.");
      }
    } catch (err) {
      const msg = err?.message || "Failed to run Stop2Melt.";
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
                Stop2Melt
              </Title>
              <Paragraph style={{ maxWidth: 920, marginBottom: 0 }}>
                Predict Stop2Melt directly from peptide sequence and optional cyclization pattern.
                This runs the new model-backed backend route and is heavier than the cyclic sequence
                similarity tool, so the first request may take longer.
              </Paragraph>
            </div>

            <Space wrap>
              <Button type={!batchMode ? "primary" : "default"} onClick={() => setBatchMode(false)}>
                Single Run
              </Button>
              <Button type={batchMode ? "primary" : "default"} onClick={() => setBatchMode(true)}>
                Batch Run
              </Button>
              <Button type="primary" htmlType="submit" form="stop2melt-form" loading={loading}>
                Run
              </Button>
            </Space>

            <Alert
              type="info"
              showIcon
              message={
                batchMode
                  ? "Batch mode: one row per line, tab-separated as sequence and optional cyclization pattern."
                  : "Single mode sends one Stop2Melt request through the backend similarity API."
              }
              description={
                batchMode
                  ? "Example row: AKLAFKKLFQLICCCFK, then a tab, then 1-8. The second field is optional."
                  : "The first prediction may take a little longer while the model and its files load."
              }
            />

            <Form
              id="stop2melt-form"
              form={form}
              layout="vertical"
              initialValues={{ cyclization_pattern: "" }}
              onFinish={handleSubmit}
            >
              {!batchMode ? (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Sequence"
                      name="sequence"
                      rules={[{ required: true, message: "Please enter a sequence" }]}
                    >
                      <TextArea rows={5} placeholder="e.g. AKLAFKKLFQLICCCFK" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item label="Cyclization Pattern" name="cyclization_pattern">
                      <TextArea rows={5} placeholder="e.g. 1-8 or 1-20, 3-15" />
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
                      "AKLAFKKLFQLICCCFK\t",
                      "ACDEFGHIK\t1-9",
                    ].join("\n")}
                  />
                </Form.Item>
              )}
            </Form>
          </Space>
        </Card>

        {error ? <Alert type="error" showIcon message={error} /> : null}

        {singleResult ? (
          <Card title="Prediction Result" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Space wrap>
                <Tag color="blue">Sequence length: {singleResult.sequence?.length || 0}</Tag>
                <Tag color="green">
                  Predicted Stop2Melt: {Number(singleResult.pred_stop2melt).toFixed(6)}
                </Tag>
              </Space>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card size="small" title="Inputs">
                    <Space direction="vertical" size={6}>
                      <Text>
                        <strong>Sequence:</strong> <Text code>{singleResult.sequence}</Text>
                      </Text>
                      <Text>
                        <strong>Cyclization:</strong>{" "}
                        <Text code>{singleResult.cyclization_pattern || ""}</Text>
                      </Text>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </Space>
          </Card>
        ) : null}

        {batchResult ? (
          <Card title="Batch Results" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Tag>Total: {batchResult.count}</Tag>
              <Table
                rowKey={(record) => `stop2melt-${record._rowIndex}`}
                columns={batchColumns}
                dataSource={batchResult.results || []}
                pagination={{ pageSize: 10 }}
              />
            </Space>
          </Card>
        ) : null}
      </Space>
    </div>
  );
}
