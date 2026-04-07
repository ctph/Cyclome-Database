#!/usr/bin/env python3
"""
Cyclicity-aware sequence similarity calculator for cyclic peptides
using GLOBAL alignment (Needleman-Wunsch).

Logic implemented
-----------------
1. e2e:
   - duplicate the template sequence (N->C concatenation)
   - align query globally against duplicated template

2. s2e or s2s:
   - use original template sequence directly

3. e2e+s2s:
   - generate duplicated template
   - additionally generate alternative T-templates from each s2s bridge:
       template[0:i] + template[j-1:]
     where bridge is i-j (1-based indices, i < j)
   - align query against all candidate T-templates
   - return the maximum score

4. s2e+s2s:
   - generate alternative T-templates from each s2s bridge
   - align query against all candidate T-templates
   - return the maximum score

Notes
-----
- Cyclization info is entered as a comma-separated string, e.g.:
      "2-4, 1-10"
- Residue indices are assumed to be 1-based.
- End-to-end (e2e) is detected when a bridge connects residue 1 and residue N.
- Side-to-end (s2e) is detected when exactly one end of a bridge is terminal (1 or N).
- Side-to-side (s2s) is detected when neither residue is terminal.
"""

from dataclasses import dataclass
from typing import List, Tuple, Dict, Any


@dataclass
class AlignmentResult:
    score: int
    similarity_percent: float
    identity_percent: float
    aligned_query: str
    aligned_template: str
    match_line: str


def clean_sequence(seq: str) -> str:
    return seq.replace(" ", "").replace("\n", "").upper()


def parse_cyclization_info(cyclization_str: str) -> List[Tuple[int, int]]:
    if not cyclization_str.strip():
        return []

    pairs = []
    for item in cyclization_str.split(","):
        item = item.strip()
        if not item:
            continue
        if "-" not in item:
            raise ValueError(f"Invalid bridge format: '{item}'. Expected format like '2-4'.")
        a, b = item.split("-")
        a, b = int(a.strip()), int(b.strip())
        if a == b:
            raise ValueError(f"Invalid bridge '{item}': residues cannot be identical.")
        if a > b:
            a, b = b, a
        pairs.append((a, b))
    return pairs


def classify_cyclization(seq_len: int, bridges: List[Tuple[int, int]]) -> str:
    has_e2e = False
    has_s2e = False
    has_s2s = False

    for a, b in bridges:
        if not (1 <= a <= seq_len and 1 <= b <= seq_len):
            raise ValueError(f"Bridge ({a}, {b}) is outside sequence length {seq_len}.")

        if a == 1 and b == seq_len:
            has_e2e = True
        elif a in (1, seq_len) or b in (1, seq_len):
            has_s2e = True
        else:
            has_s2s = True

    if has_e2e and has_s2s:
        return "e2e+s2s"
    if has_s2e and has_s2s:
        return "s2e+s2s"
    if has_e2e:
        return "e2e"
    if has_s2e:
        return "s2e"
    if has_s2s:
        return "s2s"
    return "linear"


def build_candidate_templates(template_seq: str, bridges: List[Tuple[int, int]]) -> Tuple[str, List[str]]:
    n = len(template_seq)
    topology = classify_cyclization(n, bridges)
    candidates = []

    if topology in {"linear", "s2e", "s2s"}:
        candidates.append(template_seq)

    if topology in {"e2e", "e2e+s2s"}:
        candidates.append(template_seq + template_seq)

    if topology in {"e2e+s2s", "s2e+s2s"}:
        for a, b in bridges:
            if a != 1 and a != n and b != 1 and b != n:
                left = template_seq[:a]
                right = template_seq[b - 1:]
                alt = left + right
                if alt:
                    candidates.append(alt)

        if topology == "s2e+s2s":
            candidates.append(template_seq)

    unique_candidates = []
    seen = set()
    for c in candidates:
        if c not in seen:
            unique_candidates.append(c)
            seen.add(c)

    return topology, unique_candidates


def needleman_wunsch(
    seq1: str,
    seq2: str,
    match_score: int = 2,
    mismatch_score: int = -1,
    gap_penalty: int = -2
) -> AlignmentResult:
    """
    Global alignment using Needleman-Wunsch.
    """
    m, n = len(seq1), len(seq2)

    score_matrix = [[0] * (n + 1) for _ in range(m + 1)]
    traceback = [[None] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        score_matrix[i][0] = i * gap_penalty
        traceback[i][0] = "up"

    for j in range(1, n + 1):
        score_matrix[0][j] = j * gap_penalty
        traceback[0][j] = "left"

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            diag = score_matrix[i - 1][j - 1] + (
                match_score if seq1[i - 1] == seq2[j - 1] else mismatch_score
            )
            up = score_matrix[i - 1][j] + gap_penalty
            left = score_matrix[i][j - 1] + gap_penalty

            best = max(diag, up, left)
            score_matrix[i][j] = best

            if best == diag:
                traceback[i][j] = "diag"
            elif best == up:
                traceback[i][j] = "up"
            else:
                traceback[i][j] = "left"

    aligned1 = []
    aligned2 = []
    i, j = m, n

    while i > 0 or j > 0:
        direction = traceback[i][j]
        if direction == "diag":
            aligned1.append(seq1[i - 1])
            aligned2.append(seq2[j - 1])
            i -= 1
            j -= 1
        elif direction == "up":
            aligned1.append(seq1[i - 1])
            aligned2.append("-")
            i -= 1
        elif direction == "left":
            aligned1.append("-")
            aligned2.append(seq2[j - 1])
            j -= 1
        else:
            break

    aligned1 = "".join(reversed(aligned1))
    aligned2 = "".join(reversed(aligned2))

    match_line = []
    matches = 0
    non_gap_compared = 0
    total_alignment_len = len(aligned1)

    for a, b in zip(aligned1, aligned2):
        if a == b and a != "-":
            match_line.append("|")
            matches += 1
            non_gap_compared += 1
        elif a != "-" and b != "-":
            match_line.append(".")
            non_gap_compared += 1
        else:
            match_line.append(" ")

    identity_percent = 100.0 * matches / total_alignment_len if total_alignment_len > 0 else 0.0
    similarity_percent = 100.0 * matches / non_gap_compared if non_gap_compared > 0 else 0.0

    return AlignmentResult(
        score=score_matrix[m][n],
        similarity_percent=similarity_percent,
        identity_percent=identity_percent,
        aligned_query=aligned1,
        aligned_template=aligned2,
        match_line="".join(match_line),
    )


def cyclicity_aware_similarity(
    query_seq: str,
    template_seq: str,
    template_cyclization: str,
    match_score: int = 2,
    mismatch_score: int = -1,
    gap_penalty: int = -2,
) -> Dict[str, Any]:
    """
    Compute cyclicity-aware similarity using GLOBAL alignment.
    """
    query_seq = clean_sequence(query_seq)
    template_seq = clean_sequence(template_seq)
    bridges = parse_cyclization_info(template_cyclization)

    topology, candidate_templates = build_candidate_templates(template_seq, bridges)

    best_result = None
    best_template = None

    for candidate in candidate_templates:
        result = needleman_wunsch(
            query_seq,
            candidate,
            match_score=match_score,
            mismatch_score=mismatch_score,
            gap_penalty=gap_penalty,
        )
        if best_result is None or result.score > best_result.score:
            best_result = result
            best_template = candidate

    return {
        "query_sequence": query_seq,
        "template_sequence": template_seq,
        "template_cyclization": bridges,
        "topology_class": topology,
        "candidate_templates": candidate_templates,
        "best_template_used": best_template,
        "best_alignment_score": best_result.score,
        "best_similarity_percent": round(best_result.similarity_percent, 2),
        "best_identity_percent": round(best_result.identity_percent, 2),
        "aligned_query": best_result.aligned_query,
        "aligned_template": best_result.aligned_template,
        "match_line": best_result.match_line,
    }


def main():
    print("\nCyclicity-aware Sequence Similarity Calculator (Global Alignment)\n")

    query_seq = input("Enter query sequence: ").strip()
    template_seq = input("Enter template sequence: ").strip()
    cyclization_info = input("Enter template cyclization info (e.g. 2-4, 1-10): ").strip()

    result = cyclicity_aware_similarity(
        query_seq=query_seq,
        template_seq=template_seq,
        template_cyclization=cyclization_info,
        match_score=2,
        mismatch_score=-1,
        gap_penalty=-2,
    )

    print("\n===== RESULT =====")
    print(f"Topology class        : {result['topology_class']}")
    print(f"Template bridges      : {result['template_cyclization']}")
    print(f"Candidate T-templates : {result['candidate_templates']}")
    print(f"Best template used    : {result['best_template_used']}")
    print(f"Best alignment score  : {result['best_alignment_score']}")
    print(f"Similarity (%)        : {result['best_similarity_percent']}")
    print(f"Identity (%)          : {result['best_identity_percent']}")

    print("\nBest global alignment:")
    print(result["aligned_query"])
    print(result["match_line"])
    print(result["aligned_template"])


if __name__ == "__main__":
    main()
