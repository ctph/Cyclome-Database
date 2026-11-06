#!/usr/bin/env python3
"""Import the supplied CycloMetal-ML prediction table without executing its HTML."""
import argparse
from decimal import Decimal, InvalidOperation
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path


class PredictionParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.headers = []
        self.rows = []
        self.heading = ""
        self.document_title = ""
        self.note = ""
        self.section = None
        self.capture = None
        self.buffer = []
        self.row = None
        self.cell_highlighted = False
        self.highlighted = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"script", "iframe", "object", "embed"} or any(name.lower().startswith("on") for name in attrs):
            raise ValueError("Active HTML is not permitted in a prediction source")
        if tag in {"thead", "tbody"}:
            self.section = tag
        elif tag == "tr":
            self.row = []
            self.highlighted = []
        if tag in {"title", "h1", "th", "td"} or (tag == "p" and "note" in attrs.get("class", "").split()):
            self.capture = tag
            self.buffer = []
            self.cell_highlighted = "predicted" in attrs.get("class", "").split()

    def handle_data(self, data):
        if self.capture:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag == self.capture:
            text = "".join(self.buffer).strip()
            if tag == "title":
                self.document_title = text
            elif tag == "h1":
                self.heading = text
            elif tag == "p":
                self.note = " ".join(text.split())
            elif tag in {"th", "td"} and self.row is not None:
                if self.cell_highlighted:
                    self.highlighted.append(len(self.row))
                self.row.append(text)
            self.capture = None
            self.buffer = []
        if tag == "tr" and self.row is not None:
            if self.section == "thead":
                self.headers = self.row
            elif self.section == "tbody":
                self.rows.append((self.row, self.highlighted))
            self.row = None
        elif tag in {"thead", "tbody"}:
            self.section = None


def build_predictions(source):
    parser = PredictionParser()
    parser.feed(source.decode("utf-8-sig"))
    parser.close()
    classes = ["Co", "Ln", "Mn", "Ni", "Zn"]
    expected = ["Cyclome-PDB", "Cyclization", *classes, "Predicted", "Confidence"]
    if parser.headers != expected or not parser.heading or not parser.note:
        raise ValueError("Unexpected prediction-table headers or missing heading/note")
    rows, identities = [], set()
    for index, (cells, highlighted) in enumerate(parser.rows):
        if len(cells) != len(expected) or not cells[0]:
            raise ValueError(f"Incomplete prediction row {index + 1}")
        structure, cyclization = cells[:2]
        identity = (structure, cyclization)
        if identity in identities:
            raise ValueError(f"Duplicate prediction identity: {identity}")
        identities.add(identity)
        probabilities = {name: cells[column].removeprefix("✓").strip() for column, name in enumerate(classes, 2)}
        predicted, confidence = cells[-2:]
        if predicted not in classes or highlighted != [classes.index(predicted) + 2]:
            raise ValueError(f"Predicted class/highlight mismatch in row {index + 1}")
        try:
            values = [Decimal(value) for value in probabilities.values()]
            conf = Decimal(confidence)
        except InvalidOperation as error:
            raise ValueError(f"Invalid probability in row {index + 1}") from error
        if any(not value.is_finite() or value < 0 or value > 1 for value in [*values, conf]):
            raise ValueError(f"Out-of-range probability in row {index + 1}")
        if conf != Decimal(probabilities[predicted]) or conf != max(values):
            raise ValueError(f"Confidence does not match the highest supplied probability in row {index + 1}")
        rows.append({"structure": structure, "cyclization": cyclization,
                     "probabilities": probabilities, "predicted": predicted, "confidence": confidence})
    if not rows:
        raise ValueError("The prediction table is empty")
    return {"heading": parser.heading, "sourceDocumentTitle": parser.document_title,
            "note": parser.note, "classes": classes, "rows": rows,
            "statistics": {"predictions": len(rows), "structures": len({row["structure"] for row in rows}), "classes": len(classes)},
            "source": {"filename": "CycloMetal-ML-predictions.html", "bytes": len(source),
                       "sha256": hashlib.sha256(source).hexdigest()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", required=True, type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "frontend/public/data/cyclometal")
    args = parser.parse_args()
    source = args.html.read_bytes()
    predictions = build_predictions(source)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "ml-predictions.json").write_text(json.dumps(predictions, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (args.output_dir / "CycloMetal-ML-predictions.html").write_bytes(source)
    print(json.dumps({"statistics": predictions["statistics"], "source": predictions["source"]}, indent=2))


if __name__ == "__main__":
    main()
