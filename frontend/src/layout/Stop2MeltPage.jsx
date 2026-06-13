import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Progress,
  Result,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import Header from "../components/Header";
import TurnstileBox from "../components/TurnstileBox";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const POLL_INTERVAL_MS = 2000;
const TERMINAL_JOB_STATUSES = new Set(["finished", "failed", "stopped", "canceled"]);

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

async function readJson(response) {
  return response.json().catch(() => null);
}

export default function Stop2MeltPage() {
  const [form] = Form.useForm();
  const pollingTimeoutRef = useRef(null);
  const lastJobIdRef = useRef(null);
  const lastJobTokenRef = useRef("");
  const turnstileWidgetRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [singleResult, setSingleResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState("");
  const [jobState, setJobState] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  };

  const resetResults = () => {
    setSingleResult(null);
    setBatchResult(null);
    setError("");
    setJobState(null);
    lastJobTokenRef.current = "";
  };

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

  const handleJobFinished = (jobData) => {
    const result = jobData?.result;
    if (!result) {
      throw new Error("Job finished without a result payload.");
    }

    if (batchMode) {
      const results = (result?.results || []).map((item, index) => ({
        ...item,
        _rowIndex: index,
      }));
      setBatchResult({ ...result, results });

      const errorCount = results.filter((item) => item.error).length;
      if (errorCount > 0) {
        message.warning(`Batch finished with ${errorCount} error(s).`);
      } else {
        message.success("Stop2Melt batch run completed.");
      }
    } else {
      setSingleResult(result);
      message.success("Stop2Melt prediction completed.");
    }
  };

  const pollJob = async (jobId) => {
    try {
      const headers = lastJobTokenRef.current
        ? { "X-Cyclome-Job-Token": lastJobTokenRef.current }
        : {};
      const response = await fetch(`/api/similarity/stop2melt/jobs/${jobId}`, {
        headers,
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(data?.error || `Job polling failed (${response.status})`);
      }

      setJobState(data);

      if (!TERMINAL_JOB_STATUSES.has(data?.status)) {
        pollingTimeoutRef.current = setTimeout(() => {
          pollJob(jobId);
        }, POLL_INTERVAL_MS);
        return;
      }

      stopPolling();
      setLoading(false);

      if (data.status === "finished") {
        handleJobFinished(data);
        return;
      }

      const failureMessage = data?.error || data?.message || `Job ended with status: ${data?.status || "unknown"}`;
      setError(failureMessage);
      message.error(failureMessage);
    } catch (err) {
      stopPolling();
      setLoading(false);
      const msg = err?.message || "Failed while polling Stop2Melt job.";
      setError(msg);
      message.error(msg);
    }
  };

  const handleSubmit = async (values) => {
    stopPolling();
    setLoading(true);
    resetResults();

    try {
      if (!turnstileToken) {
        throw new Error("Verification is required before submitting.");
      }

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
        headers: {
          "Content-Type": "application/json",
          "X-Cyclome-Turnstile-Token": turnstileToken,
        },
        body: JSON.stringify(payload),
      });
      turnstileWidgetRef.current?.reset();

      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      if (!data?.task_id) {
        throw new Error("Backend accepted the request but did not return a task id.");
      }

      lastJobIdRef.current = data.task_id;
      lastJobTokenRef.current = data.job_token || "";
      setJobState({
        id: data.task_id,
        status: data.status || "queued",
        progress: 0,
        message: "queued",
      });
      message.success("Stop2Melt job submitted. Polling for results...");
      await pollJob(data.task_id);
    } catch (err) {
      stopPolling();
      setLoading(false);
      const msg = err?.message || "Failed to run Stop2Melt.";
      setError(msg);
      message.error(msg);
      turnstileWidgetRef.current?.reset();
    }
  };

  const handleCancelJob = async () => {
    const jobId = lastJobIdRef.current;
    if (!jobId) return;

    try {
      const response = await fetch(`/api/similarity/stop2melt/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: lastJobTokenRef.current
          ? { "X-Cyclome-Job-Token": lastJobTokenRef.current }
          : {},
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(data?.error || `Cancel failed (${response.status})`);
      }

      stopPolling();
      setLoading(false);
      setJobState((prev) => ({ ...prev, status: data?.status || "canceled" }));
      message.info("Stop2Melt job canceled.");
    } catch (err) {
      message.error(err?.message || "Failed to cancel job.");
    }
  };

  const currentProgress = Number(jobState?.progress ?? (loading ? 5 : 0));
  const currentStatus = String(jobState?.status || "idle");
  const canCancel = loading && jobState?.id && ["queued", "started", "deferred"].includes(currentStatus);

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
                Requests now run as background jobs, so the page can stay responsive while the model works.
              </Paragraph>
            </div>

            <Space wrap>
              <Button type={!batchMode ? "primary" : "default"} onClick={() => setBatchMode(false)}>
                Single Run
              </Button>
              <Button type={batchMode ? "primary" : "default"} onClick={() => setBatchMode(true)}>
                Batch Run
              </Button>
              <Button type="primary" htmlType="submit" form="stop2melt-form" loading={loading} disabled={!turnstileToken}>
                Run
              </Button>
              {canCancel ? <Button danger onClick={handleCancelJob}>Cancel Job</Button> : null}
            </Space>

            <Alert
              type="info"
              showIcon
              message={
                batchMode
                  ? "Batch mode: one row per line, tab-separated as sequence and optional cyclization pattern."
                  : "Single mode submits one Stop2Melt job through the backend similarity API."
              }
              description={
                batchMode
                  ? "Example row: AKLAFKKLFQLICCCFK, then a tab, then 1-8. The second field is optional."
                  : "You can leave the page open while the backend worker processes the prediction."
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
              <Form.Item>
                <TurnstileBox
                  ref={turnstileWidgetRef}
                  disabled={loading}
                  onToken={setTurnstileToken}
                />
              </Form.Item>
            </Form>
          </Space>
        </Card>

        {jobState ? (
          <Card title="Job Status" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Space wrap>
                <Tag color="blue">Job ID: {jobState.id}</Tag>
                <Tag color={currentStatus === "finished" ? "green" : currentStatus === "failed" ? "red" : "gold"}>
                  Status: {currentStatus}
                </Tag>
              </Space>
              <Progress percent={Math.max(0, Math.min(100, currentProgress))} status={currentStatus === "failed" ? "exception" : undefined} />
              {jobState.message ? <Text>{jobState.message}</Text> : null}
            </Space>
          </Card>
        ) : null}

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

        {!loading && !singleResult && !batchResult && !error && jobState?.status === "canceled" ? (
          <Result status="warning" title="Job canceled" subTitle="You can adjust the input and run it again." />
        ) : null}
      </Space>
    </div>
  );
}
