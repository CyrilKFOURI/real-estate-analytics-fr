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

/** Income tax on rents, long-term rental (KPI_SPEC D13). Check each finance law. */
export const TAX_RULES = {
  /** Prélèvements sociaux on property income. To verify each year (LFSS changes). */
  socialRate: 0.172,
  marginalRates: [0, 0.11, 0.3, 0.41, 0.45],
  microFoncierAllowance: 0.3,
  microFoncierCeiling: 15_000,
  /** Long-term furnished rental (non-tourist). */
  microBicAllowance: 0.5,
  microBicCeiling: 77_700,
  /** Real regime, unfurnished: a deficit (excluding interest) offsets other income up to this amount. */
  deficitFoncierCap: 10_700,
  /** LMNP réel: land is not depreciable; building, furniture and works over these durations. */
  landShare: 0.15,
  buildingYears: 30,
  furnitureYears: 7,
  worksYears: 15,
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
