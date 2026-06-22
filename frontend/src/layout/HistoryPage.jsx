import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Space, Table, Tag, Typography } from "antd";
import Header from "../components/Header";
import { useAccount } from "../account/AccountProvider";
import { jobArtifactDownloadUrl, listJobs } from "../account/accountApi";

const { Text } = Typography;

function statusColor(status) {
  if (status === "succeeded") return "green";
  if (status === "failed") return "red";
  if (status === "running" || status === "claimed") return "blue";
  if (status === "cancel_requested" || status === "canceled") return "orange";
  return "default";
}

export default function HistoryPage() {
  const { session, error: accountError, loading: accountLoading, refreshSession, loginHref } = useAccount();
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");

  const canLoadJobs = session.mode === "guest" || session.mode === "user";

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      if (!canLoadJobs) {
        setJobs([]);
        return;
      }

      setJobsLoading(true);
      try {
        const body = await listJobs({ limit: 20 });
        if (!cancelled) {
          setJobs(body.jobs || []);
          setJobsError("");
        }
      } catch (err) {
        if (!cancelled) {
          setJobsError(err?.message || "Could not load history");
          setJobs([]);
        }
      } finally {
        if (!cancelled) {
          setJobsLoading(false);
        }
      }
    }

    loadJobs();
    return () => {
      cancelled = true;
    };
  }, [canLoadJobs, session.mode]);

  const columns = useMemo(
    () => [
      {
        title: "Job",
        dataIndex: "id",
        key: "id",
        render: (value, record) => (
          <div className="history-job-cell">
            <Text code>{value}</Text>
            <span>{record.jobType}</span>
          </div>
        ),
      },
      {
        title: "App",
        dataIndex: "appSlug",
        key: "appSlug",
        width: 120,
        render: (value) => <Tag>{value}</Tag>,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 150,
        render: (value) => <Tag color={statusColor(value)}>{value}</Tag>,
      },
      {
        title: "Created",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 210,
        render: (value) => (value ? new Date(value).toLocaleString() : "-"),
      },
      {
        title: "Result",
        key: "result",
        width: 120,
        render: (_, record) =>
          record.status === "succeeded" ? (
            <Button size="small" href={jobArtifactDownloadUrl(record.id, "result.json")}>
              Download
            </Button>
          ) : (
            "-"
          ),
      },
    ],
    [],
  );

  return (
    <div className="home-container">
      <Header />

      <main className="history-main">
        <section className="section-head">
          <span className="badge">HISTORY</span>
          <div>
            <h2>Job history</h2>
            <p className="sub">
              {session.mode === "user"
                ? "Signed-in StructF jobs for this account."
                : "Current browser session jobs for this guest session."}
            </p>
          </div>
        </section>

        {accountError ? <Alert type="warning" showIcon message={accountError} /> : null}
        {jobsError ? <Alert type="error" showIcon message={jobsError} /> : null}

        <div className="history-toolbar">
          <Space wrap>
            <Button onClick={refreshSession} loading={accountLoading || jobsLoading}>
              Refresh
            </Button>
            {session.mode !== "user" ? (
              <Button type="primary" href={loginHref}>
                Sign in
              </Button>
            ) : null}
          </Space>
        </div>

        <div className="result-card history-card">
          {canLoadJobs ? (
            <Table
              columns={columns}
              dataSource={jobs}
              loading={jobsLoading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 760 }}
              locale={{ emptyText: <Empty description="No jobs yet" /> }}
            />
          ) : (
            <Empty description="Account service unavailable" />
          )}
        </div>
      </main>
    </div>
  );
}
