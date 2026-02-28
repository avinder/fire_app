from data_pipeline.parsers.icici_parser import parse_icici_file

file_path = "data/raw/icici/OpTransactionHistory26-02-2026.xls"

df = parse_icici_file(file_path)

print(df.head())
