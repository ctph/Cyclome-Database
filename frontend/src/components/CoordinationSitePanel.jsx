import React from "react";
import { Button, Card, Checkbox, Select, Space, Table, Tag, Typography } from "antd";
import { coordinationScript, selectedCoordinationSites } from "../lib/coordinationView";

const { Paragraph, Text } = Typography;

export default function CoordinationSitePanel({ annotation, active, siteId, showDistances, showLabels, onOpen, onSiteChange, onDistancesChange, onLabelsChange }) {
  const sites = selectedCoordinationSites(annotation, siteId);
  const rows = sites.flatMap((site) => site.donors.map((donor) => ({ ...donor, siteId: site.id, color: site.color, geometry: site.geometry })));
  const prefix = process.env.PUBLIC_URL || "";

  function downloadViewerScript() {
    const script = coordinationScript(annotation, { siteId, showDistances, showLabels,
      focus: true, loadModel: true, modelUrl: `${annotation.structure}.pdb` });
    const url = URL.createObjectURL(new Blob([script], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${annotation.structure}_coordination_view.spt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Card title={<span style={{ whiteSpace: "normal" }}>Metal-coordination annotations: {annotation.structure}</span>} style={{ marginTop: 18, borderRadius: 14 }}>
      <Paragraph>These are proposed geometry centers from the supplied Jmol annotations, not experimentally observed metal atoms. Distances are calculated from each supplied center to its donor atoms in Å. The coordination view uses the matching supplied PDB coordinates.</Paragraph>
      <Space wrap style={{ marginBottom: 14 }}>
        {!active && <Button type="primary" onClick={onOpen}>Show metal sites</Button>}
        {annotation.sites.map((site) => <Tag key={site.id} color={site.color}>{site.id.replace("site", "Site ")}: {site.geometry} · CN {site.coordinationNumber} · RMSD {site.rmsd} Å</Tag>)}
        <Button href={`${prefix}${annotation.pdbUrl}`} download>Download supplied PDB</Button>
        <Button href={`${prefix}${annotation.scriptUrl}`} download>Download supplied Jmol script</Button>
        <Button onClick={downloadViewerScript}>Download viewer script</Button>
      </Space>
      {sites.some((site) => site.metals?.length) && <Paragraph type="secondary">Associated metals in the supplied screening: {sites.map((site) => `${site.id.replace("site", "Site ")}: ${(site.metals || []).join(", ")}`).join("; ")}. These associations do not establish metal occupancy.</Paragraph>}
      {active && <>
        <Paragraph type="secondary">Select one site for a labeled close-up, or all sites for an overview. The viewer supports mouse rotation and zoom.</Paragraph>
        <Space wrap style={{ marginBottom: 14 }}>
          <Select aria-label="Coordination site" style={{ width: "min(300px, 70vw)" }} value={siteId} onChange={onSiteChange} options={[
            { value: "all", label: `All ${annotation.sites.length} supplied sites` },
            ...annotation.sites.map((site) => ({ value: site.id, label: `${site.id.replace("site", "Site ")}: ${site.geometry} — ${site.description}` })),
          ]} />
          <Checkbox checked={showDistances} onChange={(event) => onDistancesChange(event.target.checked)}>Show distances</Checkbox>
          <Checkbox checked={showLabels} onChange={(event) => onLabelsChange(event.target.checked)}>Show residue/atom labels</Checkbox>
        </Space>
        <Table size="small" pagination={false} rowKey={(row) => `${row.siteId}-${row.serial}`} dataSource={rows} scroll={{ x: 620 }} columns={[
          { title: "Site / geometry", key: "site", render: (_, row) => <Tag color={row.color}>{row.siteId.replace("site", "Site ")} / {row.geometry}</Tag> },
          { title: "Donor residue / atom", key: "donor", render: (_, row) => <Text code>{row.label} (chain {row.chain})</Text> },
          { title: "Center–donor distance (Å)", dataIndex: "distanceAngstrom", render: (value) => Number(value).toFixed(2) },
        ]} />
      </>}
    </Card>
  );
}
