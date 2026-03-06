# Cyclome-Database

Cyclome Database for Agrivax.

## Repository Structure

- `backend/` — data processing and metadata assets
- `frontend/` — web application

## Metadata Curation Template

The metadata curation template lives at:

- `backend/metadata/missing_metadata_curation_template.csv`

Current CSV schema:

1. `PDB_ID`
2. `PDB_File`
3. `Sequence`
4. `Cyclization`
5. `Organism_Scientific_Name`
6. `Method`
7. `Release_Date`
8. `Keywords`
9. `Title`
10. `Missing_Fields`

### Notes

- `Researcher_Notes` is no longer part of the template.
- `Release_Date` values in this template are normalized to title-cased month format (e.g., `31-Jan-94`).
