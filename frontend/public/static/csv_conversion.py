import pandas as pd

# read CSV
df = pd.read_csv("cyclome_for_website_with_metadata.csv")

# convert to JSON
df.to_json(
    "cyclome_for_website_with_metadata.json",
    orient="records",
    indent=2
)
