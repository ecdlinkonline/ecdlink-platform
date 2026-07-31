import { prisma } from "@/lib/db/prisma";
import {
  buildDashboardMetrics,
  type SuperAdminDashboardMetrics,
} from "@/lib/dashboard/dashboard-metrics";
export type SuperAdminDashboardData = {
  totalCentres: number;
  totalUsers: number;
  totalSuppliers: number;
  targets: {
    annualCentres: number;
  };
  metrics: SuperAdminDashboardMetrics;
};
export async function getSuperAdminDashboard(): Promise<SuperAdminDashboardData> {
  const now = new Date();

  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );

  const [
    totalCentres,
    totalUsers,
    totalSuppliers,
    membershipRevenue,
    monthlyProcurement,
    totalSubmittedFundingApplications,
    approvedFundingApplications,
  ] = await Promise.all([
    prisma.ecdCentre.count(),
    prisma.user.count(),
    prisma.supplier.count(),
    prisma.membershipPayment.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: "PAID",
      },
    }),
    prisma.procurementOrder.aggregate({
      _sum: {
        total: true,
      },
      where: {
        submittedAt: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
        status: {
          notIn: ["DRAFT", "REJECTED", "CANCELLED"],
        },
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
   ]);

  const annualCentresTarget = 40;

const totalMembershipRevenue = Number(
  membershipRevenue._sum.amount ?? 0
);

const totalMonthlyProcurement = Number(
  monthlyProcurement._sum.total ?? 0
);

return {
  totalCentres,
  totalUsers,
  totalSuppliers,
  targets: {
    annualCentres: annualCentresTarget,
  },
  metrics: buildDashboardMetrics({
    totalCentres,
    annualCentresTarget,
    membershipRevenue: totalMembershipRevenue,
    monthlyProcurement: totalMonthlyProcurement,
    totalSubmittedFundingApplications,
    approvedFundingApplications,
  }),
};
}
