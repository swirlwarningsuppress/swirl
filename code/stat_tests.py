from scipy.stats import ttest_rel
import pandas as pd

# Read the data
data = pd.read_csv("code/data/post-task.csv")
data = data.iloc[:, :9]  # Keep only the first 9 columns
data = data.drop(columns=["Timestamp", "What is your participant ID? ", "Which task did you work on?"])

# Filter the rows for SWIRL and WarningInspector
swirl = data[data["Which tool did you use? "] == "SWIRL (which derives the summary rules for grouping warnings)"]
baseline = data[data["Which tool did you use? "] == "WarningInspector"]

# Loop through each metric
for metric in data.columns:
    if metric == "Which tool did you use? ":
        continue

    swirl_metric = swirl[metric].dropna().astype(float).tolist()
    baseline_metric = baseline[metric].dropna().astype(float).tolist()

    # Calculate T-Test
    t_stat, p_value = ttest_rel(swirl_metric, baseline_metric)
    
    # Calculate Variance and Standard Deviation
    swirl_variance = pd.Series(swirl_metric).var()
    swirl_std_dev = pd.Series(swirl_metric).std()
    swirl_median = pd.Series(swirl_metric).median()
    baseline_variance = pd.Series(baseline_metric).var()
    baseline_std_dev = pd.Series(baseline_metric).std()
    baseline_median = pd.Series(baseline_metric).median()

    # Print Results
    print()
    print(f"Metric: {metric}")
    print(f"SWIRL - Variance: {swirl_variance}, Std Dev: {swirl_std_dev}, Median: {swirl_median}")
    print(f"Baseline - Variance: {baseline_variance}, Std Dev: {baseline_std_dev}, Median: {baseline_median}")
    print(f"T-Statistic: {t_stat}")
    print(f"P-Value: {p_value}")
    print()

    if p_value < 0.1:
        print("The difference is statistically significant for", metric)
    else:
        print("The difference is not statistically significant for", metric)
