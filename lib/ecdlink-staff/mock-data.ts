export type StaffSessionMode = "IN_PERSON" | "MICROSOFT_TEAMS" | "ECDLINK_LIVE_CHAT" | "HYBRID";

export const staffMockMetrics = {
  todaysSessions: 3,
  openTasks: 12,
  supportCases: 5,
  upcomingEvents: 4,
  unreadMessages: 4
};

export const staffMockSessions = [
  { id: "session-1", title: "Centre support check-in", centreName: "Little Stars ECD Centre", time: "09:00", mode: "IN_PERSON" as StaffSessionMode },
  { id: "session-2", title: "Compliance document review", centreName: "Bright Beginnings", time: "11:30", mode: "MICROSOFT_TEAMS" as StaffSessionMode },
  { id: "session-3", title: "Funding readiness coaching", centreName: "Siyakhula Kids", time: "14:00", mode: "HYBRID" as StaffSessionMode },
  { id: "session-4", title: "Quick principal support", centreName: "Masakhane ECD", time: "15:30", mode: "ECDLINK_LIVE_CHAT" as StaffSessionMode }
];

export const staffMockActivity = [
  "Compliance note added for assigned centre.",
  "Procurement follow-up marked for next cycle.",
  "Centre support session scheduled.",
  "Funding readiness checklist reviewed."
];
