import { staffDepartmentConfig } from "@/config/ecdlink-staff";
import { prisma } from "@/lib/db/prisma";
import { staffMockActivity, staffMockMetrics, staffMockSessions } from "@/lib/ecdlink-staff/mock-data";

export type StaffDashboardData = Awaited<ReturnType<typeof getStaffDashboardData>>;

export async function getStaffDashboardData(staffProfileId: string) {
  const staffProfile = await prisma.ecdlinkStaffProfile.findUniqueOrThrow({
    where: { id: staffProfileId },
    include: {
      centreAssignments: {
        where: { isActive: true },
        include: { centre: true },
        orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }]
      }
    }
  });

  const centreIds = staffProfile.centreAssignments.map((assignment) => assignment.centreId);
  const complianceReviews = centreIds.length
    ? await prisma.ecdCentre.count({
        where: {
          id: { in: centreIds },
          complianceStatus: { in: ["ATTENTION", "ACTION_REQUIRED"] }
        }
      })
    : 0;
  const department = staffDepartmentConfig[staffProfile.department];

  return {
    staff: {
      id: staffProfile.id,
      firstName: staffProfile.firstName,
      lastName: staffProfile.lastName,
      jobTitle: staffProfile.jobTitle,
      department: staffProfile.department,
      departmentLabel: department.label,
      departmentFocus: department.focus
    },
    stats: {
      assignedCentres: staffProfile.centreAssignments.length,
      todaysSessions: staffMockMetrics.todaysSessions,
      openTasks: staffMockMetrics.openTasks,
      supportCases: staffMockMetrics.supportCases,
      complianceReviews,
      upcomingEvents: staffMockMetrics.upcomingEvents,
      unreadMessages: staffMockMetrics.unreadMessages
    },
    priorities: department.defaultPriorities,
    sessions: staffMockSessions,
    assignedCentres: staffProfile.centreAssignments.slice(0, 5).map((assignment) => ({
      id: assignment.centre.id,
      slug: assignment.centre.slug,
      name: assignment.centre.centreName,
      region: assignment.centre.region ?? assignment.centre.area ?? "Unassigned region",
      principal: assignment.centre.principalName ?? assignment.centre.contactPerson ?? "Principal pending",
      children: assignment.centre.numberOfChildren ?? 0,
      complianceStatus: assignment.centre.complianceStatus,
      membershipStatus: assignment.centre.membershipStatus,
      role: assignment.assignmentRole,
      isPrimary: assignment.isPrimary
    })),
    recentActivity: staffMockActivity
  };
}
