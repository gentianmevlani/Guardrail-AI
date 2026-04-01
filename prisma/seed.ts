import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create test users
  const hashedPassword = await bcrypt.hash("testpassword123", 10);

  const testUser = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });
  console.log(`✅ Created test user: ${testUser.email}`);

  const proUser = await prisma.user.upsert({
    where: { email: "pro-user@test.com" },
    update: {},
    create: {
      email: "pro-user@test.com",
      name: "Pro User",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });
  console.log(`✅ Created pro user: ${proUser.email}`);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@guardrail.app" },
    update: {},
    create: {
      email: "admin@guardrail.app",
      name: "Admin User",
      password: await bcrypt.hash("adminpassword123", 10),
      emailVerified: new Date(),
    },
  });
  console.log(`✅ Created admin user: ${adminUser.email}`);

  // Create test projects
  const demoProject = await prisma.project.upsert({
    where: { id: "demo-project-1" },
    update: {},
    create: {
      id: "demo-project-1",
      name: "Demo Project",
      description: "A demo project for testing",
      repositoryUrl: "https://github.com/guardrail/demo-project",
      userId: testUser.id,
    },
  });
  console.log(`✅ Created demo project: ${demoProject.name}`);

  // Create sample usage record (simulating a scan)
  await prisma.usageRecord.create({
    data: {
      userId: testUser.id,
      projectId: demoProject.id,
      type: "scan",
      count: 1,
      metadata: {
        score: 85,
        status: "completed",
        summary: "Good overall health with minor improvements suggested",
        findings: [
          {
            id: "finding-1",
            type: "security",
            severity: "medium",
            title: "Outdated dependency",
            description: "lodash@4.17.20 has known vulnerabilities",
            file: "package.json",
            line: 15,
            suggestion: "Update to lodash@4.17.21 or later",
          },
          {
            id: "finding-2",
            type: "code-quality",
            severity: "low",
            title: "Missing error handling",
            description: "API call lacks proper error handling",
            file: "src/api/client.ts",
            line: 42,
            suggestion: "Wrap in try-catch and handle errors appropriately",
          },
        ],
      },
    },
  });
  console.log(`✅ Created sample usage record for: ${demoProject.name}`);

  // Create subscription for pro user
  await prisma.subscription.create({
    data: {
      userId: proUser.id,
      tier: "pro",
      status: "active",
      stripeCustomerId: "cus_test_pro_user",
      stripeSubscriptionId: "sub_test_pro_subscription",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });
  console.log(`✅ Created pro subscription for: ${proUser.email}`);

  // Create API key for test user
  await prisma.apiKey.create({
    data: {
      userId: testUser.id,
      name: "Test API Key",
      key: "gr_test_" + Math.random().toString(36).substring(2, 15),
    },
  });
  console.log(`✅ Created API key for: ${testUser.email}`);

  // Create sample scans - one passing and one failing
  // Note: This uses raw SQL since the Scan model may not be in the Prisma client yet
  try {
    // Create a passing scan
    await prisma.$executeRaw`
      INSERT INTO scans (id, user_id, project_path, branch, status, progress, verdict, score, 
                         files_scanned, lines_scanned, issues_found, critical_count, warning_count, info_count,
                         started_at, completed_at, duration_ms, created_at, updated_at)
      VALUES (
        'scan-seed-pass-001',
        ${testUser.id},
        'demo-project',
        'main',
        'completed',
        100,
        'pass',
        92,
        150,
        12500,
        3,
        0,
        2,
        1,
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '55 minutes',
        300000,
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '55 minutes'
      )
      ON CONFLICT (id) DO NOTHING
    `;
    console.log(`✅ Created passing scan: scan-seed-pass-001`);

    // Create a failing scan
    await prisma.$executeRaw`
      INSERT INTO scans (id, user_id, project_path, branch, status, progress, verdict, score,
                         files_scanned, lines_scanned, issues_found, critical_count, warning_count, info_count,
                         started_at, completed_at, duration_ms, created_at, updated_at)
      VALUES (
        'scan-seed-fail-001',
        ${testUser.id},
        'demo-project',
        'feature/new-api',
        'completed',
        100,
        'fail',
        45,
        150,
        12500,
        12,
        3,
        5,
        4,
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '1 hour 50 minutes',
        600000,
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '1 hour 50 minutes'
      )
      ON CONFLICT (id) DO NOTHING
    `;
    console.log(`✅ Created failing scan: scan-seed-fail-001`);

    // Create findings for the failing scan
    await prisma.$executeRaw`
      INSERT INTO findings (id, scan_id, type, severity, category, file, line, title, message, confidence, status, created_at)
      VALUES 
        ('finding-seed-001', 'scan-seed-fail-001', 'route_issue', 'critical', 'route_integrity', '/api/users', 1, 'Dead route detected', 'Route /api/users is defined but has no handler', 0.95, 'open', NOW()),
        ('finding-seed-002', 'scan-seed-fail-001', 'route_issue', 'critical', 'route_integrity', '/api/payments', 1, 'Dead route detected', 'Route /api/payments is defined but has no handler', 0.95, 'open', NOW()),
        ('finding-seed-003', 'scan-seed-fail-001', 'link_issue', 'critical', 'route_integrity', 'src/pages/dashboard.tsx', 45, 'Broken link', 'Link to /settings/billing returns 404', 0.9, 'open', NOW()),
        ('finding-seed-004', 'scan-seed-fail-001', 'placeholder', 'warning', 'code_quality', 'src/api/client.ts', 12, 'TODO found', 'TODO: Implement error handling', 0.8, 'open', NOW()),
        ('finding-seed-005', 'scan-seed-fail-001', 'placeholder', 'warning', 'code_quality', 'src/utils/auth.ts', 78, 'FIXME found', 'FIXME: This is a temporary workaround', 0.8, 'open', NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    console.log(`✅ Created findings for failing scan`);

    // Create findings for the passing scan (minor issues only)
    await prisma.$executeRaw`
      INSERT INTO findings (id, scan_id, type, severity, category, file, line, title, message, confidence, status, created_at)
      VALUES 
        ('finding-seed-006', 'scan-seed-pass-001', 'placeholder', 'info', 'code_quality', 'src/components/Header.tsx', 23, 'TODO found', 'TODO: Add dark mode toggle', 0.7, 'open', NOW()),
        ('finding-seed-007', 'scan-seed-pass-001', 'placeholder', 'warning', 'code_quality', 'src/lib/analytics.ts', 56, 'Console log detected', 'console.log statement in production code', 0.85, 'open', NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    console.log(`✅ Created findings for passing scan`);

  } catch (error) {
    console.log(`⚠️ Skipping scan seed (table may not exist): ${error}`);
  }

  // Create audit events for activity history
  try {
    await prisma.auditEvent.createMany({
      data: [
        {
          type: 'scan.started',
          category: 'scan',
          severity: 'info',
          source: 'dashboard',
          userId: testUser.id,
          metadata: { projectPath: 'demo-project', branch: 'main' },
        },
        {
          type: 'scan.completed',
          category: 'scan',
          severity: 'info',
          source: 'worker',
          userId: testUser.id,
          metadata: { scanId: 'scan-seed-pass-001', verdict: 'pass', score: 92 },
        },
        {
          type: 'scan.started',
          category: 'scan',
          severity: 'info',
          source: 'dashboard',
          userId: testUser.id,
          metadata: { projectPath: 'demo-project', branch: 'feature/new-api' },
        },
        {
          type: 'scan.completed',
          category: 'scan',
          severity: 'warning',
          source: 'worker',
          userId: testUser.id,
          metadata: { scanId: 'scan-seed-fail-001', verdict: 'fail', score: 45 },
        },
      ],
      skipDuplicates: true,
    });
    console.log(`✅ Created audit events for scan history`);
  } catch (error) {
    console.log(`⚠️ Skipping audit events seed: ${error}`);
  }

  console.log("🎉 Database seeded successfully!");
  console.log("");
  console.log("📋 Test Credentials:");
  console.log("   Email: test@example.com");
  console.log("   Password: testpassword123");
  console.log("");
  console.log("   Pro User: pro-user@test.com");
  console.log("   Password: testpassword123");
  console.log("");
  console.log("   Admin: admin@guardrail.app");
  console.log("   Password: adminpassword123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
