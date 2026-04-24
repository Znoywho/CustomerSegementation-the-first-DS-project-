# Customer Segmentation Frontend

## Run local

From project root:

```bash
python -m http.server 8080
```

Open:

- `http://localhost:8080/frontend/index.html`

## Required data files

The page reads these files from `artifacts/dashboard`:

- `cluster_summary.json`
- `cluster_word_category_interpretation.json`
- `category_by_cluster.csv`
- `customer_segments.csv`

If missing, run the export cells in `Final.ipynb` first.
