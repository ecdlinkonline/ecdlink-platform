import { prisma } from "@/lib/db/prisma";

export type FundingDashboardData = {
  centresTracked: number;
  averageReadiness: number;
  submittedApplications: number;
  approvedApplications: number;
  totalRequestedAmount: number;
};

export async function getFundingDashboard(): Promise<FundingDashboardData> {
  const [
    centresTracked,
    readiness,
    submittedApplications,
    approvedApplications,
    requestedAmount,
  ] = await Promise.all([
    prisma.fundingProfile.count(),
    prisma.fundingProfile.aggregate({
      _avg: {
        readinessScore: true,
      },
    }),
    prisma.fundingApplication.count({
      where: {
        submittedAt: {
          not: null,
        },
      },
    }),
    prisma.fundingApplication.count({
      where: {
        submittedAt: {
          not: null,
        },
        status: "APPROVED",
      },
    }),
    prisma.fundingProject.aggregate({
      _sum: {
        requestedAmount: true,
      },
    }),
  ]);

  return {
    centresTracked,
    averageReadiness: Math.round(Number(readiness._avg.readinessScore ?? 0)),
    submittedApplications,
    approvedApplications,
    totalRequestedAmount: Number(requestedAmount._sum.requestedAmount ?? 0),
  };
}
