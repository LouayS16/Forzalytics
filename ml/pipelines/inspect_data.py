import argparse
import os
import pandas as pd


def print_header(title: str):
    print("\n" + "=" * 80)
    print(f" {title}")
    print("=" * 80)


def show_columns(df: pd.DataFrame, filter_text: str = None):
    cols = df.columns
    if filter_text:
        cols = [c for c in cols if filter_text.lower() in c.lower()]
        print_header(f"MATCHING COLUMNS ('{filter_text}'): {len(cols)} found")
    else:
        print_header(f"COLUMNS LIST ({len(cols)} total)")

    for i, col in enumerate(cols, 1):
        dtype = df[col].dtype
        null_count = df[col].isnull().sum()
        pct_null = (null_count / len(df)) * 100
        print(f"{i:2d}. {col:<25} | Dtype: {str(dtype):<10} | Nulls: {null_count:>6,} ({pct_null:>5.1f}%)")


def show_head(df: pd.DataFrame, n_rows: int = 5, select_cols: list = None):
    print_header(f"FIRST {n_rows} ROWS (HEAD)")
    target_df = df[select_cols] if select_cols else df
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 1000)
    print(target_df.head(n_rows))


def show_tail(df: pd.DataFrame, n_rows: int = 5, select_cols: list = None):
    print_header(f"LAST {n_rows} ROWS (TAIL)")
    target_df = df[select_cols] if select_cols else df
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 1000)
    print(target_df.tail(n_rows))


def show_value_counts(df: pd.DataFrame, col_name: str, top_n: int = 15):
    if col_name not in df.columns:
        print(f"Error: Column '{col_name}' not found.")
        return
    print_header(f"TOP VALUE COUNTS: {col_name}")
    vc = df[col_name].value_counts(dropna=False).head(top_n)
    pct = (df[col_name].value_counts(dropna=False, normalize=True) * 100).round(2).head(top_n)
    summary = pd.DataFrame({"Count": vc, "Percentage (%)": pct})
    print(summary)


def show_summary(df: pd.DataFrame):
    print_header("SUMMARY & STATISTICS")
    print(f"Total Rows   : {df.shape[0]:,}")
    print(f"Total Columns: {df.shape[1]}")
    print(f"Duplicates   : {df.duplicated().sum():,}")

    numeric_cols = df.select_dtypes(include="number").columns
    if len(numeric_cols) > 0:
        print(f"\nNumerical Columns ({len(numeric_cols)}):")
        print(df.describe().round(2))


def inspect_all(df: pd.DataFrame, file_path: str, n_rows: int = 5):
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print_header(f"DATASET OVERVIEW: {os.path.basename(file_path)}")
    print(f"File Path    : {os.path.abspath(file_path)}")
    print(f"File Size    : {file_size_mb:.2f} MB")
    print(f"Shape        : {df.shape[0]:,} rows x {df.shape[1]} columns")

    show_columns(df)
    show_head(df, n_rows=n_rows)
    show_summary(df)


def main():
    from pathlib import Path
    base_dir = Path(__file__).resolve().parent.parent.parent
    default_candidates = [
        base_dir / "ml" / "data" / "cleaned_dataset.csv",
        base_dir / "cleaned_dataset.csv",
        base_dir / "ml" / "data" / "full_data.csv",
        base_dir / "full_data.csv",
    ]
    resolved_default = next((str(p) for p in default_candidates if p.exists()), "ml/data/cleaned_dataset.csv")

    parser = argparse.ArgumentParser(
        description="Inspect and consult CSV datasets (columns, head, statistics, etc.)"
    )
    parser.add_argument(
        "file",
        nargs="?",
        default=resolved_default,
        help="Path to the CSV file (default: ml/data/cleaned_dataset.csv)",
    )
    parser.add_argument(
        "-c", "--columns", action="store_true", help="Display column names, types, and missing values"
    )
    parser.add_argument(
        "--find-col", type=str, help="Search for column names containing a keyword"
    )
    parser.add_argument(
        "--select", nargs="+", help="Specific column names to display in head/tail"
    )
    parser.add_argument(
        "--head",
        nargs="?",
        const=5,
        type=int,
        help="Display the first N rows (default: 5)",
    )
    parser.add_argument(
        "--tail",
        nargs="?",
        const=5,
        type=int,
        help="Display the last N rows (default: 5)",
    )
    parser.add_argument(
        "-s", "--summary", action="store_true", help="Display summary statistics (describe)"
    )
    parser.add_argument(
        "--counts", type=str, help="Show value counts for a specific column"
    )

    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"Error: File '{args.file}' does not exist.")
        return

    print(f"Loading '{args.file}'...")
    df = pd.read_csv(args.file, low_memory=False)
    print(f"Loaded successfully ({df.shape[0]:,} rows, {df.shape[1]} columns).\n")

    flag_passed = any([
        args.columns,
        args.find_col,
        args.head is not None,
        args.tail is not None,
        args.summary,
        args.counts,
    ])

    if flag_passed:
        if args.columns:
            show_columns(df)
        if args.find_col:
            show_columns(df, filter_text=args.find_col)
        if args.counts:
            show_value_counts(df, args.counts)
        if args.head is not None:
            show_head(df, n_rows=args.head, select_cols=args.select)
        if args.tail is not None:
            show_tail(df, n_rows=args.tail, select_cols=args.select)
        if args.summary:
            show_summary(df)
    else:
        # Default behavior: full inspection
        inspect_all(df, args.file, n_rows=5)



if __name__ == "__main__":
    main()

