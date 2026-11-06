import React, { useEffect } from "react";
import { Card, Tabs, Typography } from "antd";
import { useLocation, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import CycloMetalMLPanel from "./CycloMetalMLPanel";
import CycloMetalGeomPanel from "./CycloMetalGeomPanel";
import "./CycloMetalPage.css";

const { Title, Paragraph } = Typography;

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
        <Card>
          <Title level={2}>CycloMetal</Title>
          <Paragraph>Explore the supplied sequence/topology-based ML predictions and structure-based metal-coordination geometry hits in the tabs below.</Paragraph>
        </Card>
        <Tabs
          activeKey={activeTab}
          onChange={changeTab}
          items={[
            { key: "ml", label: "CycloMetal-ML", children: <CycloMetalMLPanel /> },
            { key: "geom", label: "CycloMetal-Geom", children: <CycloMetalGeomPanel /> },
          ]}
        />
      </main>
    </div>
  );
}
