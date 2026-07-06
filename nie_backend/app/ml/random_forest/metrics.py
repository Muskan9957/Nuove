from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
import pandas as pd

def calculate_metrics(y_true: pd.Series, y_pred: pd.Series, y_prob: pd.Series) -> dict:
    """
    Calculates standard classification metrics for the Random Forest model.
    """
    # Safe handling if we only have one class in the test set (rare but possible in small data)
    try:
        auc = roc_auc_score(y_true, y_prob)
    except ValueError:
        auc = 0.5  # Default if ROC AUC can't be calculated

    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "auc": float(auc)
    }
