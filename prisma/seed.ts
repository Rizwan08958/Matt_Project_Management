import { PrismaClient, Role, ProjectStatus, Priority, ProjectType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: adminPassword,
      name: "Admin User",
      role: Role.ADMIN,
      department: "Management",
      position: "System Administrator",
      isActive: true,
    },
  });
  console.log("Created admin:", admin.email);

  // Create BA
  const baPassword = await bcrypt.hash("ba123", 10);
  await prisma.user.upsert({
    where: { email: "ba@example.com" },
    update: {},
    create: {
      email: "ba@example.com",
      password: baPassword,
      name: "Sarah BA",
      role: Role.BA,
      department: "Engineering",
      position: "Business Analyst",
      isActive: true,
    },
  });

  // Create Team Leader
  const teamLeaderPassword = await bcrypt.hash("teamleader123", 10);
  const teamLeader = await prisma.user.upsert({
    where: { email: "teamleader@example.com" },
    update: {},
    create: {
      email: "teamleader@example.com",
      password: teamLeaderPassword,
      name: "Tom Team Leader",
      role: Role.TEAMLEADER,
      department: "Engineering",
      position: "Team Leader",
      isActive: true,
    },
  });
  console.log("Created BA and team leader");

  // Create employees
  const employeePassword = await bcrypt.hash("employee123", 10);
  const employees = await Promise.all([
    prisma.user.upsert({
      where: { email: "john@example.com" },
      update: {},
      create: {
        email: "john@example.com",
        password: employeePassword,
        name: "John Developer",
        role: Role.EMPLOYEE,
        department: "Engineering",
        position: "Senior Developer",
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "jane@example.com" },
      update: {},
      create: {
        email: "jane@example.com",
        password: employeePassword,
        name: "Jane Designer",
        role: Role.EMPLOYEE,
        department: "Design",
        position: "UI/UX Designer",
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "mike@example.com" },
      update: {},
      create: {
        email: "mike@example.com",
        password: employeePassword,
        name: "Mike Backend",
        role: Role.EMPLOYEE,
        department: "Engineering",
        position: "Backend Developer",
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "lisa@example.com" },
      update: {},
      create: {
        email: "lisa@example.com",
        password: employeePassword,
        name: "Lisa Frontend",
        role: Role.EMPLOYEE,
        department: "Engineering",
        position: "Frontend Developer",
        isActive: true,
      },
    }),
  ]);
  console.log("Created employees:", employees.length);

  // Create projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { code: "PRJ-001" },
      update: {},
      create: {
        name: "E-Commerce Platform",
        description: "Building a modern e-commerce platform with Next.js",
        code: "PRJ-001",
        type: ProjectType.TEAM,
        status: ProjectStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        progress: 65,
        estimatedHours: 500,
        actualHours: 325,
        startDate: new Date("2024-01-15"),
        deadline: new Date("2024-06-30"),
        managerId: teamLeader.id,
      },
    }),
    prisma.project.upsert({
      where: { code: "PRJ-002" },
      update: {},
      create: {
        name: "Mobile App Redesign",
        description: "Redesigning the mobile app user interface",
        code: "PRJ-002",
        type: ProjectType.TEAM,
        status: ProjectStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        progress: 40,
        estimatedHours: 200,
        actualHours: 80,
        startDate: new Date("2024-02-01"),
        deadline: new Date("2024-05-15"),
        managerId: teamLeader.id,
      },
    }),
    prisma.project.upsert({
      where: { code: "PRJ-003" },
      update: {},
      create: {
        name: "API Integration",
        description: "Integrating third-party APIs for payment and shipping",
        code: "PRJ-003",
        type: ProjectType.INDIVIDUAL,
        status: ProjectStatus.ON_HOLD,
        priority: Priority.MEDIUM,
        progress: 30,
        estimatedHours: 100,
        actualHours: 30,
        startDate: new Date("2024-02-15"),
        deadline: new Date("2024-04-30"),
        holdReason: "Waiting for API credentials from vendor",
        holdStartDate: new Date("2024-03-01"),
        totalHoldDays: 0,
        managerId: teamLeader.id,
      },
    }),
    prisma.project.upsert({
      where: { code: "PRJ-004" },
      update: {},
      create: {
        name: "Documentation Update",
        description: "Updating technical documentation",
        code: "PRJ-004",
        type: ProjectType.INDIVIDUAL,
        status: ProjectStatus.COMPLETED,
        priority: Priority.LOW,
        progress: 100,
        estimatedHours: 40,
        actualHours: 35,
        startDate: new Date("2024-01-10"),
        deadline: new Date("2024-01-31"),
        completedAt: new Date("2024-01-28"),
        managerId: teamLeader.id,
      },
    }),
    prisma.project.upsert({
      where: { code: "PRJ-005" },
      update: {},
      create: {
        name: "Security Audit",
        description: "Comprehensive security audit of all systems",
        code: "PRJ-005",
        type: ProjectType.TEAM,
        status: ProjectStatus.PLANNING,
        priority: Priority.CRITICAL,
        progress: 0,
        estimatedHours: 150,
        startDate: new Date("2024-04-01"),
        deadline: new Date("2024-04-30"),
        managerId: teamLeader.id,
      },
    }),
  ]);
  console.log("Created projects:", projects.length);

  // Create project assignments
  const assignments = [
    // E-Commerce Platform - Team project
    { projectId: projects[0].id, userId: employees[0].id, role: "Lead Developer" },
    { projectId: projects[0].id, userId: employees[2].id, role: "Backend Developer" },
    { projectId: projects[0].id, userId: employees[3].id, role: "Frontend Developer" },
    // Mobile App Redesign
    { projectId: projects[1].id, userId: employees[1].id, role: "Lead Designer" },
    { projectId: projects[1].id, userId: employees[3].id, role: "Frontend Developer" },
    // API Integration
    { projectId: projects[2].id, userId: employees[2].id, role: "Developer" },
    // Documentation
    { projectId: projects[3].id, userId: employees[0].id, role: "Technical Writer" },
    // Security Audit
    { projectId: projects[4].id, userId: employees[0].id, role: "Security Lead" },
    { projectId: projects[4].id, userId: employees[2].id, role: "Backend Reviewer" },
  ];

  for (const assignment of assignments) {
    await prisma.projectAssignment.upsert({
      where: {
        projectId_userId: { projectId: assignment.projectId, userId: assignment.userId },
      },
      update: {},
      create: assignment,
    });
  }
  console.log("Created assignments:", assignments.length);

  // Create time entries for the past 30 days
  const today = new Date();
  const timeEntries = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // E-Commerce Platform entries
    timeEntries.push(
      {
        userId: employees[0].id,
        projectId: projects[0].id,
        date,
        hours: 6 + Math.random() * 2,
        description: "Working on product catalog features",
        isBillable: true,
      },
      {
        userId: employees[2].id,
        projectId: projects[0].id,
        date,
        hours: 5 + Math.random() * 3,
        description: "Backend API development",
        isBillable: true,
      },
      {
        userId: employees[3].id,
        projectId: projects[0].id,
        date,
        hours: 4 + Math.random() * 2,
        description: "Frontend component development",
        isBillable: true,
      }
    );

    // Mobile App entries
    if (i % 2 === 0) {
      timeEntries.push(
        {
          userId: employees[1].id,
          projectId: projects[1].id,
          date,
          hours: 4 + Math.random() * 2,
          description: "UI mockups and design iterations",
          isBillable: true,
        },
        {
          userId: employees[3].id,
          projectId: projects[1].id,
          date,
          hours: 2 + Math.random() * 2,
          description: "Implementing new designs",
          isBillable: true,
        }
      );
    }
  }

  await prisma.timeEntry.createMany({
    data: timeEntries.map((entry) => ({
      ...entry,
      hours: Math.round(entry.hours * 100) / 100,
    })),
    skipDuplicates: true,
  });
  console.log("Created time entries:", timeEntries.length);

  // Create some activity logs
  await prisma.activityLog.createMany({
    data: [
      {
        action: "CREATE",
        entityType: "project",
        entityId: projects[0].id,
        createdById: admin.id,
        metadata: { name: projects[0].name },
      },
      {
        action: "ASSIGN",
        entityType: "project",
        entityId: projects[0].id,
        userId: employees[0].id,
        createdById: teamLeader.id,
        metadata: { employeeName: employees[0].name },
      },
      {
        action: "STATUS_CHANGE",
        entityType: "project",
        entityId: projects[0].id,
        createdById: teamLeader.id,
        metadata: { oldStatus: "PLANNING", newStatus: "IN_PROGRESS" },
      },
      {
        action: "HOLD",
        entityType: "project",
        entityId: projects[2].id,
        createdById: teamLeader.id,
        metadata: { reason: "Waiting for API credentials from vendor" },
      },
    ],
  });
  console.log("Created activity logs");

  // Seed CRM project type budgets
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_project_types" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_project_types_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "crm_project_types_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "crm_project_types_name_lower_unique_idx"
    ON "crm_project_types" (LOWER("name"))
  `;

  const crmProjectTypes = [
    { name: "Hardware Project", budget: 15000 },
    { name: "Software Project", budget: 10000 },
    { name: "Internship Project", budget: 5000 },
  ];
  for (const item of crmProjectTypes) {
    await prisma.$executeRaw`
      INSERT INTO "crm_project_types" (
        "id",
        "name",
        "budget",
        "createdById",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${item.name},
        ${item.budget},
        ${admin.id},
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING
    `;
  }
  console.log("Seeded CRM project types:", crmProjectTypes.length);

  console.log("\n--- Seed completed successfully! ---");
  console.log("\nLogin credentials:");
  console.log("Admin:    admin@example.com / admin123");
  console.log("BA:       ba@example.com / ba123");
  console.log("Lead:     teamleader@example.com / teamleader123");
  console.log("Employee: john@example.com / employee123");
  console.log("          jane@example.com / employee123");
  console.log("          mike@example.com / employee123");
  console.log("          lisa@example.com / employee123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
