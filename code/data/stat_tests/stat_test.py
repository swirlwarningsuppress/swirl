import pandas as pd
import statsmodels.api as sm
from statsmodels.formula.api import mixedlm
import numpy as np

CSV_FILE1 = "./nasa_tlx.csv"

# Load the data
data = pd.read_csv(CSV_FILE1)

# Assign subject IDs (every two rows = one subject)
data["subject"] = data.index // 2

# Assign workload dimensions
data["mental_demand"] = data.iloc[:, 3]
data["hurriedness"] = data.iloc[:, 4]
data["success"] = data.iloc[:, 5]
data["effort"] = data.iloc[:, 6]
data["frustration"] = data.iloc[:, 7]

# Derive task type and order
data["task_type"] = data["task"].apply(lambda x: "Spotbugs" if "Spotbugs" in x else "Infer")
data["task_order"] = data.groupby("subject").cumcount() + 1

print(data.head())

# Helper function to fit model and compute R²
def fit_model_and_r2(formula, outcome):
    model = mixedlm(formula, data, groups=data["subject"])
    result = model.fit()
    print(result.summary())

    # Compute R²m and R²c
    y_obs = data[outcome]
    
    try:
        y_fixed = result.predict(exog=data)          # Fixed effects only
    except Exception as e:
        print("Error predicting fixed effects:", e)
        return

    y_total = result.fittedvalues                    # Fixed + random

    var_fixed = np.var(y_fixed, ddof=1)
    var_random = float(result.cov_re.iloc[0, 0]) if result.cov_re.shape != (0, 0) else 0
    var_resid = result.scale

    r2_m = var_fixed / (var_fixed + var_random + var_resid)
    r2_c = (var_fixed + var_random) / (var_fixed + var_random + var_resid)

    print(f"R²_m (Marginal): {r2_m:.3f}")
    print(f"R²_c (Conditional): {r2_c:.3f}")
    print("\n" + "="*60 + "\n")

# Run for each TLX dimension
fit_model_and_r2("mental_demand ~ tool + task_type + task_order", "mental_demand")
fit_model_and_r2("hurriedness ~ tool + task_type + task_order", "hurriedness")
fit_model_and_r2("success ~ tool + task_type + task_order", "success")
fit_model_and_r2("effort ~ tool + task_type + task_order", "effort")
fit_model_and_r2("frustration ~ tool + task_type + task_order", "frustration")
