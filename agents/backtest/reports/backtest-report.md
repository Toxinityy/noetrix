# Backtest Report

## METH_APR

- disagreeScale (tuned on train): 490
- steps: 624 train / 272 test

| agent | accuracy | calibration | resolved | mean test score |
|---|---:|---:|---:|---:|
| ARIMA | 998325 | -9666 | 896 | 998334 |
| EWMA-Vol | 998325 | -9666 | 896 | 998334 |
| Mean-Reversion | 998325 | -9666 | 896 | 998288 |
| Momentum | 998325 | -9666 | 896 | 998288 |
| Naive | 998325 | -9666 | 896 | 998273 |
| Sentiment (F&G) | 998325 | -9666 | 895 | 998242 |

### Inter-agent error correlation (diversity proof)

| | Naive | ARIMA | Mean-Reversion | Momentum | EWMA-Vol | Sentiment (F&G) |
|---|---:|---:|---:|---:|---:|---:|
| Naive | 1.00 | 0.68 | 0.99 | 1.00 | 0.71 | 0.12 |
| ARIMA | 0.68 | 1.00 | 0.79 | 0.68 | 0.92 | -0.11 |
| Mean-Reversion | 0.99 | 0.79 | 1.00 | 0.98 | 0.81 | 0.08 |
| Momentum | 1.00 | 0.68 | 0.98 | 1.00 | 0.69 | 0.13 |
| EWMA-Vol | 0.71 | 0.92 | 0.81 | 0.69 | 1.00 | -0.09 |
| Sentiment (F&G) | 0.12 | -0.11 | 0.08 | 0.13 | -0.09 | 1.00 |

Stress distribution: Calm 0 · Elevated 213 · Stressed 683

## AAVE_TVL

- disagreeScale (tuned on train): 18605122371597231
- steps: 69 train / 34 test

| agent | accuracy | calibration | resolved | mean test score |
|---|---:|---:|---:|---:|
| Momentum | 984786 | -59739 | 103 | 989039 |
| Naive | 985571 | -15602 | 103 | 989034 |
| Mean-Reversion | 983032 | -17073 | 103 | 988164 |
| Sentiment (F&G) | 982875 | -24172 | 103 | 986835 |
| ARIMA | 975741 | -98074 | 103 | 976006 |
| EWMA-Vol | 912942 | -62477 | 103 | 896393 |

### Inter-agent error correlation (diversity proof)

| | Naive | ARIMA | Mean-Reversion | Momentum | EWMA-Vol | Sentiment (F&G) |
|---|---:|---:|---:|---:|---:|---:|
| Naive | 1.00 | 0.93 | 0.86 | 0.85 | 0.38 | 0.89 |
| ARIMA | 0.93 | 1.00 | 0.67 | 0.89 | 0.09 | 0.71 |
| Mean-Reversion | 0.86 | 0.67 | 1.00 | 0.47 | 0.69 | 0.85 |
| Momentum | 0.85 | 0.89 | 0.47 | 1.00 | -0.07 | 0.65 |
| EWMA-Vol | 0.38 | 0.09 | 0.69 | -0.07 | 1.00 | 0.67 |
| Sentiment (F&G) | 0.89 | 0.71 | 0.85 | 0.65 | 0.67 | 1.00 |

Stress distribution: Calm 0 · Elevated 27 · Stressed 76

## USDY_APY

- disagreeScale (tuned on train): 26
- steps: 84 train / 40 test

| agent | accuracy | calibration | resolved | mean test score |
|---|---:|---:|---:|---:|
| ARIMA | 998325 | -9666 | 124 | 998334 |
| EWMA-Vol | 998325 | -9666 | 124 | 998334 |
| Naive | 992075 | -8476 | 124 | 992084 |
| Mean-Reversion | 992075 | -8476 | 124 | 992084 |
| Momentum | 992075 | -8476 | 124 | 992084 |
| Sentiment (F&G) | 990251 | -8143 | 124 | 991521 |

### Inter-agent error correlation (diversity proof)

| | Naive | ARIMA | Mean-Reversion | Momentum | EWMA-Vol | Sentiment (F&G) |
|---|---:|---:|---:|---:|---:|---:|
| Naive | 1.00 | 0.67 | 0.82 | 0.21 | 0.51 | -0.28 |
| ARIMA | 0.67 | 1.00 | 0.75 | -0.42 | 0.69 | -0.47 |
| Mean-Reversion | 0.82 | 0.75 | 1.00 | -0.03 | 0.60 | -0.36 |
| Momentum | 0.21 | -0.42 | -0.03 | 1.00 | -0.54 | 0.34 |
| EWMA-Vol | 0.51 | 0.69 | 0.60 | -0.54 | 1.00 | -0.59 |
| Sentiment (F&G) | -0.28 | -0.47 | -0.36 | 0.34 | -0.59 | 1.00 |

Stress distribution: Calm 0 · Elevated 0 · Stressed 124
