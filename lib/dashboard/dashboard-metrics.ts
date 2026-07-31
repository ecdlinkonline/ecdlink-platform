export type DashboardMetric = {
  value: number;
  target: number;
  progress: number;
};

export type FundingSuccessMetric = DashboardMetric & {
  submitted: number;
  approved: number;
};

export type SuperAdminDashboardMetrics = {
  centreGrowth: DashboardMetric;
  membershipRevenue: DashboardMetric;
  monthlyProcurement: DashboardMetric;
  fundingSuccess: FundingSuccessMetric;
};

type BuildDashboardMetricsInput = {
  totalCentres: number;
  annualCentresTarget: number;
  membershipRevenue: number;
  monthlyProcurement: number;
  totalSubmittedFundingApplications: number;
  approvedFundingApplications: number;
};

export function buildDashboardMetrics({
  totalCentres,
  annualCentresTarget,
  membershipRevenue,
  monthlyProcurement,
  totalSubmittedFundingApplications,
  approvedFundingApplications,
}: BuildDashboardMetricsInput): SuperAdminDashboardMetrics {
  const fundingSuccessPercentage =
    totalSubmittedFundingApplications === 0
      ? 0
      : Math.round(
          (approvedFundingApplications /
            totalSubmittedFundingApplications) *
            100
        );

  return {
    centreGrowth: {
      value: totalCentres,
      target: annualCentresTarget,
      progress: Math.min(
        (totalCentres / annualCentresTarget) * 100,
        100
      ),
    },

    membershipRevenue: {
  value: membershipRevenue,
  target: 25000,
  progress: Math.min((membershipRevenue / 25000) * 100, 100),
},

    monthlyProcurement: {
  value: monthlyProcurement,
  target: 300000,
  progress: Math.min(
    (monthlyProcurement / 300000) * 100,
    100
  ),
},

    fundingSuccess: {
      value: fundingSuccessPercentage,
      target: 75,
      progress: fundingSuccessPercentage,
      submitted: totalSubmittedFundingApplications,
      approved: approvedFundingApplications,
    },
  };
}
