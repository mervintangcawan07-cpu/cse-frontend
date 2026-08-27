import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { numericalNotesData } from "./data/numericalNotes";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getBootstrapAdminCredentials() {
  const configuredEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!configuredEmail || configuredEmail.trim().length === 0) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is required");
  }

  const email = configuredEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address");
  }

  if (!password || password.trim().length === 0) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD is required");
  }

  if (password.length < 6) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 6 characters");
  }

  return { email, password };
}

async function main() {
  const { email: adminEmail, password: adminPassword } = getBootstrapAdminCredentials();

  console.log("🌱 Starting safe database seeding (preserving existing users and data)...");

  // 1. Upsert Admin Account (NO USER DELETIONS)
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "ADMIN",
      isPaid: true,
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: "System Admin",
      role: "ADMIN",
      isPaid: true,
    },
  });

  console.log("✓ Admin account verified");

  // 2. Seed Question Bank safely
  console.log("Checking and seeding question bank...");
  const sampleQuestions = [
    {
      category: "Verbal Ability",
      prompt: "Which of the following is a synonym for 'ephemeral'?",
      options: ["Permanent", "Transient", "Eternal", "Substantial"],
      answerIndex: 1,
      explanation:
        "'Ephemeral' means lasting for a very short time, which is synonymous with 'transient'.",
    },
    {
      category: "Numerical Reasoning",
      prompt: "If 15% of a number is 45, what is 40% of that same number?",
      options: ["100", "120", "150", "180"],
      answerIndex: 1,
      explanation:
        "Let the number be x. 0.15x = 45 => x = 300. Then 40% of 300 is 0.40 * 300 = 120.",
    },
    {
      category: "General Information",
      prompt:
        "According to the 1987 Philippine Constitution, who has the sole power to declare the existence of a state of war?",
      options: [
        "The President",
        "The Supreme Court",
        "The Congress",
        "The AFP Chief of Staff",
      ],
      answerIndex: 2,
      explanation:
        "Article VI, Section 23(1) states that Congress, by a vote of two-thirds of both Houses in joint session, has the sole power to declare the existence of a state of war.",
    },
    {
      category: "Analytical Reasoning",
      prompt: "Complete the series: 2, 6, 12, 20, 30, ___",
      options: ["38", "40", "42", "44"],
      answerIndex: 2,
      explanation:
        "The differences between consecutive numbers increase by 2: +4, +6, +8, +10, so the next addition is +12 (30 + 12 = 42).",
    },
    {
      category: "Verbal Ability",
      prompt: "Identify the correctly spelled word:",
      options: ["Accomodate", "Accommodate", "Acommodate", "Accommodat"],
      answerIndex: 1,
      explanation: "'Accommodate' has double 'c' and double 'm'.",
    },
  ];

  for (const q of sampleQuestions) {
    const existing = await prisma.question.findFirst({
      where: { prompt: q.prompt },
    });
    if (!existing) {
      await prisma.question.create({ data: q });
    }
  }
  console.log("✓ Question bank verified!");

  // 3. Upsert 50 Numerical Ability Study Notes
  console.log("Upserting 50 Numerical Ability Study Notes...");
  const reversedNotes = [...numericalNotesData].reverse();

  for (const note of reversedNotes) {
    const noteId = `num-note-${note.title.split('.')[0].trim()}`;
    await prisma.studyNote.upsert({
      where: { id: noteId },
      update: {
        category: note.category,
        title: note.title,
        summary: note.summary,
        content: note.content,
        tips: note.tips,
      },
      create: {
        id: noteId,
        category: note.category,
        title: note.title,
        summary: note.summary,
        content: note.content,
        tips: note.tips,
      },
    });
  }
  console.log("✓ Numerical Ability Study Notes upserted successfully!");

  // 4. Clean Obsolete Plans & Seed 3 Standard Plans
  if ((prisma as any).pricingPlan) {
    console.log("Purging old plan entries and syncing 3 clean pricing plans...");

    // Remove unsupported legacy plan keys so only the 3 standard plans remain
    await (prisma as any).pricingPlan.deleteMany({
      where: {
        planType: {
          notIn: ["1_MONTH", "6_MONTHS", "1_YEAR"],
        },
      },
    });

    const plansToSeed = [
      { planType: "1_MONTH", name: "1-Month Pass", price: 99, durationDays: 30 },
      { planType: "6_MONTHS", name: "6-Month Pass", price: 199, durationDays: 180 },
      { planType: "1_YEAR", name: "1-Year Pass", price: 299, durationDays: 365 },
    ];

    for (const plan of plansToSeed) {
      await (prisma as any).pricingPlan.upsert({
        where: { planType: plan.planType },
        update: {
          name: plan.name,
          price: plan.price,
          durationDays: plan.durationDays,
        },
        create: plan,
      });
    }
    console.log("✓ Clean pricing plans configured successfully!");
  }

  console.log("\n✅ SAFE SEEDING COMPLETED SUCCESSFULLY!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });