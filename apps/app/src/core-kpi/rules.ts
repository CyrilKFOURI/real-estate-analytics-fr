// French rules and market defaults used by the simulator. Check once a year (KPI_SPEC §2):
// they change with finance laws and HCSF decisions. Values as of 2026-10.
export const FR_RULES = {
  checkedOn: '2026-10-20',
  /** Notary fees ("frais de notaire") as a share of the price. */
  notaryRateOld: 0.075,
  notaryRateNew: 0.025,
  /** HCSF: debt service / income must stay ≤ 35 %, loans ≤ 25 years. */
  hcsfMaxDebtRatio: 0.35,
  hcsfMaxYears: 25,
  /** Banks count only 70 % of future rent as income (vacancy, charges). */
  rentCountedByBanks: 0.7,
  /** Delagrandanne's quick test: 70 % of the rent must cover the loan payment. */
  quickTestRentShare: 0.7,
} as const;

/** Prefill values, all editable in the simulator. */
export const DEFAULTS = {
  downPaymentShare: 0.1,
  loanRate: 0.035,
  loanYears: 20,
  loanInsuranceRate: 0.003,
  vacancyMonths: 1,
  pnoInsuranceYearly: 150,
  managementShare: 0,
  maintenanceShare: 0.05,
} as const;
