#!/usr/bin/env python3
"""Import the supplied geometry matrix and CSV without executing supplied HTML."""

import argparse
import csv
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re


class MatrixParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.headers = []
        self.rows = []
        self.heading = ""
        self.document_title = ""
        self.in_head = False
        self.in_body = False
        self.capture = None
        self.buffer = []
        self.row = None
        self.cell = None
        self.hit = None

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "iframe", "object", "embed"}:
            raise ValueError(f"Unexpected active HTML element: {tag}")
        if any(name.lower().startswith("on") for name, _ in attrs):
            raise ValueError("Event handlers are not permitted in the source table")
        if tag == "thead":
            self.in_head = True
        elif tag == "tbody":
            self.in_body = True
        elif tag == "tr":
            self.row = []
        elif tag == "td" and self.in_body:
            self.cell = []
        elif tag == "details" and self.cell is not None:
            self.hit = {}
        if tag in {"title", "h1", "th", "summary"} or (tag == "div" and self.hit is not None):
            self.capture = tag
            self.buffer = []

    def handle_data(self, data):
        if self.capture:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        text = "".join(self.buffer).strip()
        if tag == self.capture:
            if tag == "title":
                self.document_title = text
            elif tag == "h1":
                self.heading = text
            elif tag == "th" and self.row is not None:
                self.row.append(text)
            elif tag == "summary" and self.hit is not None:
                self.hit["shape"] = text
            elif tag == "div" and self.hit is not None:
                self.hit["details"] = text
            self.capture = None
            self.buffer = []
        if tag == "details" and self.hit is not None:
            if not self.hit.get("shape") or not self.hit.get("details"):
                raise ValueError("Incomplete geometry hit")
            match = re.fullmatch(r"(.+); RMSD ([0-9]+(?:\.[0-9]+)?) Å", self.hit["details"])
            if not match:
                raise ValueError("Unrecognized hit detail: " + self.hit["details"])
            self.hit["residues"], self.hit["rmsd"] = match.groups()
            self.cell.append(self.hit)
            self.hit = None
        elif tag == "td" and self.cell is not None:
            self.row.append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.in_head:
                self.headers = self.row
            elif self.in_body:
                self.rows.append(self.row)
            self.row = None
        elif tag == "thead":
            self.in_head = False
        elif tag == "tbody":
            self.in_body = False


def build_catalog(html_bytes, csv_bytes):
    parser = MatrixParser()
    parser.feed(html_bytes.decode("utf-8-sig"))
    parser.close()
    if not parser.heading or not parser.headers or parser.headers[0] != "Structure":
        raise ValueError("Missing matrix heading or structure column")
    geometries = list(csv.DictReader(io.StringIO(csv_bytes.decode("utf-8-sig"))))
    if not geometries or set(geometries[0]) != {"shape_name", "description", "coord_number"}:
        raise ValueError("Unexpected geometry legend schema")
    geometry_codes = {row["shape_name"] for row in geometries}
    if len(geometry_codes) != len(geometries) or not all(row["description"] and row["coord_number"] for row in geometries):
        raise ValueError("Duplicate or incomplete geometry legend entries")
    metals = parser.headers[1:]
    if len(set(metals)) != len(metals):
        raise ValueError("Duplicate metal headers")
    rows = []
    for raw in parser.rows:
        if len(raw) != len(parser.headers) or not raw[0]:
            raise ValueError("Matrix row does not match the supplied columns")
        for cell in raw[1:]:
            for hit in cell:
                if hit["shape"] not in geometry_codes:
                    raise ValueError("Geometry absent from legend: " + hit["shape"])
        rows.append({"structure": raw[0], "cells": dict(zip(metals, raw[1:]))})
    if not rows or len({row["structure"] for row in rows}) != len(rows):
        raise ValueError("Empty matrix or duplicate structure identifiers")
    return {
        "heading": parser.heading,
        "sourceDocumentTitle": parser.document_title,
        "metals": metals,
        "geometries": geometries,
        "rows": rows,
        "statistics": {
            "structures": len(rows), "metals": len(metals), "geometries": len(geometries),
            "matches": sum(len(cell) for row in rows for cell in row["cells"].values()),
        },
        "sources": {
            "cyclome-metal-hits.html": {"sha256": hashlib.sha256(html_bytes).hexdigest(), "bytes": len(html_bytes)},
            "shape_names.csv": {"sha256": hashlib.sha256(csv_bytes).hexdigest(), "bytes": len(csv_bytes)},
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", required=True, type=Path)
    parser.add_argument("--legend", required=True, type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "frontend/public/data/cyclometal")
    args = parser.parse_args()
    html_bytes, csv_bytes = args.html.read_bytes(), args.legend.read_bytes()
    catalog = build_catalog(html_bytes, csv_bytes)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (args.output_dir / "cyclome-metal-hits.html").write_bytes(html_bytes)
    (args.output_dir / "shape_names.csv").write_bytes(csv_bytes)
    print(json.dumps({"statistics": catalog["statistics"], "sources": catalog["sources"]}, indent=2))


if __name__ == "__main__":
    main()
