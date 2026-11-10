import React, { useEffect } from "react";
import { Card, Tabs, Typography } from "antd";
import { useLocation, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import CycloMetalMLPanel from "./CycloMetalMLPanel";
import CycloMetalGeomPanel from "./CycloMetalGeomPanel";
import "./CycloMetalPage.css";

const { Title, Paragraph } = Typography;

const SECTIONS = [
  {
    key: "ml",
    title: "CycloMetal-ML",
    input: "Sequence & topology",
    description: "Explore predicted metal-binding classes and their probabilities from peptide sequence and cyclization topology.",
    action: "View ML predictions",
  },
  {
    key: "geom",
    title: "CycloMetal-Geom",
    input: "3D structure & coordination",
    description: "Explore structure-based coordination-geometry hits, proposed sites, and center–donor distances in the 3D viewer.",
    action: "View geometry hits",
  },
];

export default function CycloMetalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab === "geom" || (!requestedTab && location.hash === "#metalpdb-legend") ? "geom" : "ml";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `CycloMetal-${activeTab === "ml" ? "ML" : "Geom"} | Cyclome`;
    return () => { document.title = previousTitle; };
  }, [activeTab]);

  const changeTab = (tab) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", tab);
      return next;
    });
  };

  return (
    <div className="cyclometal-page">
      <Header />
      <main className="cyclometal-content">
        <Card className="cyclometal-intro">
          <Title level={2}>CycloMetal</Title>
          <Paragraph>Two complementary approaches to cyclic-peptide metal binding. Choose a section below to explore its results.</Paragraph>
        </Card>
        <Tabs
          className="cyclometal-section-tabs"
          aria-label="CycloMetal analysis sections"
          activeKey={activeTab}
          onChange={changeTab}
          tabBarGutter={0}
          items={SECTIONS.map((section) => ({
            key: section.key,
            label: <div className="cyclometal-section-card">
              <span className="cyclometal-section-input">{section.input}</span>
              <span className="cyclometal-section-title">{section.title}</span>
              <span className="cyclometal-section-description">{section.description}</span>
              <span className="cyclometal-section-action">{activeTab === section.key
                ? <><span aria-hidden="true">✓</span> Currently viewing</>
                : <>{section.action} <span aria-hidden="true">→</span></>}</span>
            </div>,
            children: section.key === "ml" ? <CycloMetalMLPanel /> : <CycloMetalGeomPanel />,
          }))}
        />
      </main>
    </div>
  );
}
