const COLORS = new Set(["red", "blue", "green"]);

function point(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 3 || !coordinates.every(Number.isFinite)) {
    throw new Error("Invalid proposed-center coordinates.");
  }
  return `{${coordinates.join(" ")}}`;
}

function atomSelection(atom) {
  if (!Number.isInteger(atom.serial) || atom.serial < 1) throw new Error("Invalid donor atom serial.");
  return `{atomno=${atom.serial}}`;
}

export const clearCoordinationScript = "draw DELETE; measure DELETE; set echo OFF; select all; label OFF; color cartoon opaque;";

export function selectedCoordinationSites(annotation, siteId = "all") {
  return annotation.sites.filter((site) => siteId === "all" || site.id === siteId);
}

export function coordinationScript(annotation, { siteId = "all", showDistances = true, showLabels = true, focus = false, loadModel = false, modelUrl = `${process.env.PUBLIC_URL || ""}${annotation.pdbUrl}` } = {}) {
  const sites = selectedCoordinationSites(annotation, siteId);
  if (!sites.length) throw new Error("No supplied coordination site is selected.");
  const commands = [];
  if (loadModel) commands.push(`load ${JSON.stringify(modelUrl)};`);
  commands.push(clearCoordinationScript,
    "background white; select all; spacefill OFF; wireframe OFF; cartoon ONLY; color cartoon translucent [x999999];",
    'set measurementUnits angstroms; set defaultDistanceLabel "%0.2VALUE %UNITS";');
  const styledResidues = new Set();
  for (const site of sites) {
    if (!/^site\d+$/.test(site.id) || !/^[a-z]+$/.test(site.geometry) || !COLORS.has(site.color)) {
      throw new Error("Invalid coordination annotation identifier.");
    }
    const center = point(site.center);
    const id = `cm_${site.id}`;
    const donorResidues = new Map();
    for (const donor of site.donors) {
      if (!/^[A-Za-z0-9]$/.test(donor.chain) || !Number.isInteger(donor.resno)) throw new Error("Invalid donor residue.");
      donorResidues.set(`${donor.chain}:${donor.resno}`, donor);
    }
    for (const [key, donor] of donorResidues) {
      const residue = `chain=${JSON.stringify(donor.chain)} and resno=${donor.resno}`;
      if (!styledResidues.has(key)) {
        commands.push(`select {${residue} and not hydrogen}; wireframe 0.18; color wireframe cpk;`);
        commands.push(`select {${residue} and carbon}; color wireframe ${site.color};`);
        styledResidues.add(key);
      }
    }
    commands.push(`draw ID ${id}_center diameter ${Number(site.diameter)} ${center}; color $${id}_center ${site.color};`);
    for (const [index, donor] of site.donors.entries()) {
      const atom = atomSelection(donor);
      commands.push(`draw ID ${id}_spoke${index + 1} width 0.06 line ${center} (${atom}) color ${site.color};`);
      if (showLabels) commands.push(`select ${atom}; label ${JSON.stringify(donor.label)};`);
      if (showDistances) commands.push(`measure ID ${id}_distance${index + 1} ${center} (${atom});`);
    }
    const labelPosition = point([site.center[0], site.center[1] + 1.2, site.center[2]]);
    commands.push(`set echo ${id}_label ${labelPosition}; echo ${JSON.stringify(`${site.id.replace("site", "Site ")}: ${site.geometry}`)}; color echo black; font echo 14;`);
  }
  commands.push("select all; color labels black; font labels 12; set labelFront; color measures black; font measures 10;");
  if (focus) {
    commands.push(siteId === "all" ? "moveto 0 {0 1 0} 0; center all; zoom 110;" : `moveto 0 {0 1 0} 90; center ${point(sites[0].center)}; zoom 300;`);
  }
  return commands.join("\n");
}
