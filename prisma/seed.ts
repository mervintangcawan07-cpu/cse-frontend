import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🧹 Clearing existing user accounts and exam results...");

  // 1. Clear exam results first to avoid foreign key errors
  // Some Prisma schemas may name the model differently or not have a Result model.
  // Use a runtime-safe access to avoid TypeScript errors when the property doesn't exist.
  if ((prisma as any).result && typeof (prisma as any).result.deleteMany === "function") {
    await (prisma as any).result.deleteMany({});
    console.log("✓ All exam results deleted.");
  } else {
    console.log("i: No result model found on prisma client, skipping deletion of exam results.");
  }

  // 2. Clear all user and admin accounts
  await prisma.user.deleteMany({});
  console.log("✓ All user accounts deleted.");

  // 3. Define and create the Admin Account
  const adminEmail = "thamarmervin@cse.com";
  const adminPassword = "Azel110521";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: "System Admin",
      role: "ADMIN",
      isPaid: true,
    },
  });

  console.log("\n=========================================");
  console.log("🎉 NEW ADMIN ACCOUNT CREATED!");
  console.log(`Email:    ${adminUser.email}`);
  console.log(`Password: ${adminPassword}`);
  console.log("Role:     ADMIN");
  console.log("=========================================\n");

  // 4. Seed question bank (Original Content Preserved)
  console.log("Seeding question bank...");

  // Clear existing questions to prevent duplicates during testing
  await prisma.question.deleteMany({});

  await prisma.question.createMany({
    data: [
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
    ],
  });

  console.log("Questions seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });