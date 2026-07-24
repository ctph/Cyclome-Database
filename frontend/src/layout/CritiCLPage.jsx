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
import {
  cancelJob as cancelStructfJob,
  createJob as createStructfJob,
  downloadJobArtifact,
  getJob as getStructfJob,
  uploadJobArtifact,
} from "../account/accountApi";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const POLL_INTERVAL_MS = 2000;
const TERMINAL_JOB_STATUSES = new Set([
  "finished",
  "failed",
  "stopped",
  "canceled",
]);
const STRUCTF_TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed", "canceled", "expired"]);
const STRUCTF_CRITICL_JOB_TYPE = "criticl.single";

function normalizeBatchRows(rawText) {
  return String(rawText || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("\t").map((part) => part.trim());
      if (parts.length < 1 || !parts[0]) {
        throw new Error(
          `Line ${index + 1} must include a sequence in the first tab-separated column.`,
        );
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

export default function CritiCLPage() {
  const [form] = Form.useForm();
  const pollingTimeoutRef = useRef(null);
  const lastJobIdRef = useRef(null);
  const lastJobTokenRef = useRef("");
  const lastStructfJobIdRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [singleResult, setSingleResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState("");
  const [jobState, setJobState] = useState(null);
  const [geomscanResult, setGeomscanResult] = useState(null);

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
    setGeomscanResult(null);
    lastJobTokenRef.current = "";
    lastStructfJobIdRef.current = null;
  };

  const probabilityColumns = useMemo(() => ["Co", "Ln", "Mn", "Ni", "Zn"], []);

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
        title: "Prediction",
        dataIndex: "prediction",
        key: "prediction",
        render: (value) => (value ? <Tag color="blue">{value}</Tag> : "-"),
      },
      {
        title: "Confidence",
        dataIndex: "confidence_max",
        key: "confidence_max",
        render: (value) => (value == null ? "-" : Number(value).toFixed(6)),
      },
      ...probabilityColumns.map((metal) => ({
        title: `P(${metal})`,
        key: `proba_${metal}`,
        render: (_, record) => {
          const value = record?.probabilities?.[metal];
          return value == null ? "-" : Number(value).toFixed(6);
        },
      })),
      {
        title: "Error",
        dataIndex: "error",
        key: "error",
        render: (value) => (value ? <Tag color="red">{value}</Tag> : null),
      },
    ],
    [probabilityColumns],
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
        message.success("CritiCL batch run completed.");
      }
    } else {
      setSingleResult(result);
      message.success("CritiCL prediction completed.");
    }
  };

  const pollJob = async (jobId) => {
    try {
      const headers = lastJobTokenRef.current
        ? { "X-Cyclome-Job-Token": lastJobTokenRef.current }
        : {};
      const response = await fetch(`/api/similarity/criticl/jobs/${jobId}`, {
        headers,
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(
          data?.error || `Job polling failed (${response.status})`,
        );
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

      const failureMessage =
        data?.error ||
        data?.message ||
        `Job ended with status: ${data?.status || "unknown"}`;
      setError(failureMessage);
      message.error(failureMessage);
    } catch (err) {
      stopPolling();
      setLoading(false);
      const msg = err?.message || "Failed while polling CritiCL job.";
      setError(msg);
      message.error(msg);
    }
  };

  const normalizeSinglePayload = (values) => ({
    sequence: String(values.sequence || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase(),
    cyclization_pattern: String(values.cyclization_pattern || "").trim(),
  });

  const structfProgress = (status) => {
    if (status === "queued") return 5;
    if (status === "claimed") return 20;
    if (status === "running" || status === "cancel_requested") return 65;
    if (status === "succeeded") return 100;
    return 0;
  };

  const setStructfJobState = (job) => {
    const status = job?.status || "queued";
    setJobState({
      id: job?.id,
      status,
      progress: structfProgress(status),
      message:
        status === "cancel_requested"
          ? "cancel requested"
          : status === "succeeded"
            ? "completed"
            : status,
      source: "structf",
    });
  };

  const pollStructfJob = async (jobId) => {
    try {
      const body = await getStructfJob(jobId);
      const job = body?.job;
      if (!job) {
        throw new Error("Account API did not return job state.");
      }

      setStructfJobState(job);

      if (!STRUCTF_TERMINAL_JOB_STATUSES.has(job.status)) {
        pollingTimeoutRef.current = setTimeout(() => {
          pollStructfJob(jobId);
        }, POLL_INTERVAL_MS);
        return;
      }

      stopPolling();
      setLoading(false);

      if (job.status === "succeeded") {
        const artifact = await downloadJobArtifact(job.id, "result.json");
        const result = artifact?.result || artifact;
        setSingleResult(result);
        message.success("CritiCL prediction completed.");
        return;
      }

      if (job.status === "canceled") {
        message.info("CritiCL job canceled.");
        return;
      }

      const failureMessage =
        job?.errorMessage ||
        job?.errorCode ||
        `Job ended with status: ${job?.status || "unknown"}`;
      setError(failureMessage);
      message.error(failureMessage);
    } catch (err) {
      stopPolling();
      setLoading(false);
      const msg = err?.message || "Failed while polling StructF job.";
      setError(msg);
      message.error(msg);
    }
  };

  const submitStructfCriticlJob = async (payload) => {
    const createBody = await createStructfJob({
      appSlug: "cyclome",
      jobType: STRUCTF_CRITICL_JOB_TYPE,
      inputSummary: payload,
      publicLabel: `CritiCL ${payload.sequence.slice(0, 24)}`,
    });
    const job = createBody?.job;
    if (!job?.id) {
      throw new Error("Account API accepted the request but did not return a job id.");
    }

    lastJobIdRef.current = job.id;
    lastStructfJobIdRef.current = job.id;
    setStructfJobState(job);

    try {
      await uploadJobArtifact(job.id, "input.json", payload, { kind: "input" });
    } catch (err) {
      await cancelStructfJob(job.id).catch(() => null);
      throw err;
    }

    message.success("CritiCL job submitted through StructF history.");
    await pollStructfJob(job.id);
  };

  const submitLegacyCriticlJob = async (payload) => {
    const response = await fetch("/api/similarity/criticl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

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
    message.success("CritiCL job submitted. Polling for results...");
    await pollJob(data.task_id);
  };

  const handleSubmit = async (values) => {
    stopPolling();
    setLoading(true);
    resetResults();

    try {
      if (batchMode) {
        const payload = { items: normalizeBatchRows(values.batch_rows) };
        const response = await fetch("/api/similarity/criticl/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await readJson(response);
        if (!response.ok) {
          throw new Error(data?.error || `Request failed (${response.status})`);
        }

        if (!data?.task_id) {
          throw new Error(
            "Backend accepted the request but did not return a task id.",
          );
        }

        lastJobIdRef.current = data.task_id;
        lastJobTokenRef.current = data.job_token || "";
        setJobState({
          id: data.task_id,
          status: data.status || "queued",
          progress: 0,
          message: "queued",
        });
        message.success("CritiCL job submitted. Polling for results...");
        await pollJob(data.task_id);
        return;
      }

      const payload = normalizeSinglePayload(values);
      try {
        await submitStructfCriticlJob(payload);
      } catch (err) {
        if (err?.status) {
          throw err;
        }
        message.warning("StructF history unavailable. Falling back to current CritiCL job path.");
        await submitLegacyCriticlJob(payload);
      }
    } catch (err) {
      stopPolling();
      setLoading(false);
      const msg = err?.message || "Failed to run CritiCL.";
      setError(msg);
      message.error(msg);
    }
  };

  const handleCancelJob = async () => {
    const structfJobId = lastStructfJobIdRef.current;
    if (structfJobId) {
      try {
        const body = await cancelStructfJob(structfJobId);
        const job = body?.job;
        if (job) {
          setStructfJobState(job);
        }
        if (job?.status === "canceled") {
          stopPolling();
          setLoading(false);
          message.info("CritiCL job canceled.");
        } else {
          message.info("CritiCL job cancellation requested.");
        }
      } catch (err) {
        message.error(err?.message || "Failed to cancel job.");
      }
      return;
    }

    const jobId = lastJobIdRef.current;
    if (!jobId) return;

    try {
      const response = await fetch(
        `/api/similarity/criticl/jobs/${jobId}/cancel`,
        {
          method: "POST",
          headers: lastJobTokenRef.current
            ? { "X-Cyclome-Job-Token": lastJobTokenRef.current }
            : {},
        },
      );
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(data?.error || `Cancel failed (${response.status})`);
      }

      stopPolling();
      setLoading(false);
      setJobState((prev) => ({ ...prev, status: data?.status || "canceled" }));
      message.info("CritiCL job canceled.");
    } catch (err) {
      message.error(err?.message || "Failed to cancel job.");
    }
  };

  const currentProgress = Number(jobState?.progress ?? (loading ? 5 : 0));
  const currentStatus = String(jobState?.status || "idle");
  const canCancel =
    loading &&
    jobState?.id &&
    ["queued", "claimed", "running", "started", "deferred"].includes(currentStatus);

  return (
    <div style={{ padding: 16 }}>
      <Header />

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card style={{ borderRadius: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                CritiCL
              </Title>
              <Paragraph style={{ maxWidth: 920, marginBottom: 0 }}>
                Predict likely metal class directly from peptide sequence using
                the CritiCL backend. Requests run as background jobs so the page
                stays responsive while embeddings and inference complete.
              </Paragraph>
            </div>

            <Space wrap>
              <Button
                type={!batchMode ? "primary" : "default"}
                onClick={() => setBatchMode(false)}
              >
                Single Run
              </Button>
              <Button
                type={batchMode ? "primary" : "default"}
                onClick={() => setBatchMode(true)}
              >
                Batch Run
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                form="criticl-form"
                loading={loading}
              >
                Run
              </Button>
              {canCancel ? (
                <Button danger onClick={handleCancelJob}>
                  Cancel Job
                </Button>
              ) : null}
            </Space>

            <Form
              id="criticl-form"
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
                      rules={[
                        { required: true, message: "Please enter a sequence" },
                      ]}
                    >
                      <TextArea rows={5} placeholder="e.g. AKWYFGLICCKLQLK" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Cyclization Pattern"
                      name="cyclization_pattern"
                    >
                      <TextArea rows={5} placeholder="e.g. 1-9" />
                    </Form.Item>
                  </Col>
                </Row>
              ) : (
                <Form.Item
                  label="Batch Input"
                  name="batch_rows"
                  rules={[
                    {
                      required: true,
                      message: "Please paste at least one batch row",
                    },
                  ]}
                >
                  <TextArea
                    rows={10}
                    placeholder={["AKWYFGLICCKLQLK\t", "ACDEFGHIK\t1-9"].join(
                      "\n",
                    )}
                  />
                </Form.Item>
              )}
            </Form>
          </Space>
        </Card>

        {jobState ? (
          <Card title="Job Status" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Space wrap>
                <Tag color="blue">Job ID: {jobState.id}</Tag>
                <Tag
                  color={
                    currentStatus === "finished" || currentStatus === "succeeded"
                      ? "green"
                      : currentStatus === "failed"
                        ? "red"
                        : currentStatus === "canceled"
                          ? "orange"
                          : "gold"
                  }
                >
                  Status: {currentStatus}
                </Tag>
              </Space>
              <Progress
                percent={Math.max(0, Math.min(100, currentProgress))}
                status={currentStatus === "failed" ? "exception" : undefined}
              />
              {jobState.message ? <Text>{jobState.message}</Text> : null}
            </Space>
          </Card>
        ) : null}

        {error ? <Alert type="error" showIcon message={error} /> : null}

        {singleResult ? (
          <Card title="Prediction Result" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Space wrap>
                <Tag color="blue">
                  Sequence length: {singleResult.sequence?.length || 0}
                </Tag>
                <Tag color="green">
                  Prediction: {singleResult.prediction || "-"}
                </Tag>
                <Tag>
                  Confidence:{" "}
                  {singleResult.confidence_max == null
                    ? "-"
                    : Number(singleResult.confidence_max).toFixed(6)}
                </Tag>
              </Space>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card size="small" title="Inputs">
                    <Space direction="vertical" size={6}>
                      <Text>
                        <strong>Sequence:</strong>{" "}
                        <Text code>{singleResult.sequence}</Text>
                      </Text>
                      <Text>
                        <strong>Cyclization:</strong>{" "}
                        <Text code>
                          {singleResult.cyclization_pattern || ""}
                        </Text>
                      </Text>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card size="small" title="Prediction Details">
                    <Space direction="vertical" size={6}>
                      <Text>
                        <strong>Predicted class:</strong>{" "}
                        <Tag color="blue">{singleResult.prediction || "-"}</Tag>
                      </Text>
                      <Text>
                        <strong>Raw class index:</strong>{" "}
                        <Text code>{singleResult.prediction_raw}</Text>
                      </Text>
                    </Space>
                  </Card>
                </Col>
              </Row>

              <Card size="small" title="Class Probabilities">
                <Space wrap>
                  {probabilityColumns.map((metal) => (
                    <Tag key={metal} color="geekblue">
                      {metal}:{" "}
                      {singleResult?.probabilities?.[metal] == null
                        ? "-"
                        : Number(singleResult.probabilities[metal]).toFixed(6)}
                    </Tag>
                  ))}
                </Space>
              </Card>
            </Space>
          </Card>
        ) : null}

        {batchResult ? (
          <Card title="Batch Results" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Tag>Total: {batchResult.count}</Tag>
              <Table
                rowKey={(record) => `criticl-${record._rowIndex}`}
                columns={batchColumns}
                dataSource={batchResult.results || []}
                pagination={{ pageSize: 10 }}
                scroll={{ x: true }}
              />
            </Space>
          </Card>
        ) : null}

        {!loading &&
        !singleResult &&
        !batchResult &&
        !error &&
        jobState?.status === "canceled" ? (
          <Result
            status="warning"
            title="Job canceled"
            subTitle="You can adjust the input and run it again."
          />
        ) : null}

        {geomscanResult ? (
          <Card size="small" title="Geomscan Metal-Binding Hits">
            <Table
              rowKey={(_, index) => `geomscan-${index}`}
              dataSource={geomscanResult.hits || []}
              pagination={false}
              columns={[
                { title: "Geometry", dataIndex: "geometry" },
                { title: "Metal", dataIndex: "metal" },
                { title: "Score", dataIndex: "best_score" },
                { title: "Residues", dataIndex: "ligand_atoms" },
              ]}
            />
          </Card>
        ) : null}
      </Space>
    </div>
  );
}
