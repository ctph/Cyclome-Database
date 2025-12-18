import pandas as pd

input_csv = "sequence_similarity_sorted.csv"
output_json = "sequence_similarity_sorted.json"

df = pd.read_csv(input_csv)

df.to_json(
    output_json,
    orient="records",
    indent=2
)
