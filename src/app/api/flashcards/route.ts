import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

const DEFAULT_SEED_CARDS = [
  // --- VERBAL ABILITY ---
  {
    category: "Verbal Ability",
    topic: "Vocabulary",
    front: "What is the meaning of 'EPHEMERAL'?",
    back: "Lasting for a very short time; transient or fleeting.\n\nExample: 'The beauty of the morning mist was ephemeral.'",
  },
  {
    category: "Verbal Ability",
    topic: "Vocabulary",
    front: "What is the meaning of 'ALTRUISTIC'?",
    back: "Unselfishly concerned for or devoted to the welfare of others; selfless.\n\nAntonym: Selfish, Egoistic.",
  },
  {
    category: "Verbal Ability",
    topic: "Vocabulary",
    front: "What is the meaning of 'UBIQUITOUS'?",
    back: "Present, appearing, or found everywhere at the same time; omnipresent.\n\nExample: 'Smartphones have become ubiquitous in modern society.'",
  },
  {
    category: "Verbal Ability",
    topic: "Grammar & Usage",
    front: "Subject-Verb Agreement: 'Neither the manager nor the employees ___ present.' (was/were)",
    back: "WERE.\n\nRule: When subjects are connected by 'neither... nor', the verb agrees with the subject closer to it ('employees' = plural).",
  },

  // --- GENERAL INFORMATION & PH CONSTITUTION ---
  {
    category: "General Information",
    topic: "1987 PH Constitution",
    front: "What is Article XI of the 1987 Philippine Constitution?",
    back: "Accountability of Public Officers.\n\nCore Mandate: 'Public office is a public trust. Public officers and employees must at all times be accountable to the people.'",
  },
  {
    category: "General Information",
    topic: "Impeachment",
    front: "Who are the officials that can be removed ONLY through Impeachment?",
    back: "1. The President\n2. The Vice-President\n3. Members of the Supreme Court\n4. Members of Constitutional Commissions (CSC, COMELEC, COA)\n5. The Ombudsman",
  },
  {
    category: "General Information",
    topic: "R.A. 6713 (Code of Conduct)",
    front: "What is Republic Act 6713?",
    back: "The Code of Conduct and Ethical Standards for Public Officials and Employees.\n\nKey Requirement: Filing of Statement of Assets, Liabilities, and Net Worth (SALN) annually.",
  },
  {
    category: "General Information",
    topic: "1987 PH Constitution",
    front: "What is Article III of the Philippine Constitution?",
    back: "The Bill of Rights.\n\nIt guarantees fundamental civil and political rights, including due process, equal protection, and freedom of speech.",
  },

  // --- NUMERICAL REASONING ---
  {
    category: "Numerical Reasoning",
    topic: "Word Problem Formula",
    front: "What is the formula for Distance, Rate, and Time?",
    back: "Distance = Rate × Time (D = R × T)\n\n• Rate = Distance ÷ Time\n• Time = Distance ÷ Rate",
  },
  {
    category: "Numerical Reasoning",
    topic: "Percentage Formula",
    front: "How do you calculate Percentage, Rate, and Base?",
    back: "Percentage = Rate × Base (P = R × B)\n\nNote: Convert the Rate percentage to decimal first (e.g., 15% = 0.15).",
  },
  {
    category: "Numerical Reasoning",
    topic: "Work Problems",
    front: "What is the combined work rate formula if Person A takes 'a' hours and Person B takes 'b' hours?",
    back: "Combined Rate = (1/a) + (1/b) = 1/T\n\nTotal Time T = (a × b) ÷ (a + b)",
  },
  {
    category: "Numerical Reasoning",
    topic: "Averages",
    front: "How do you calculate the Average (Arithmetic Mean)?",
    back: "Average = (Sum of all items) ÷ (Total number of items)",
  },
];

export async function GET() {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    if (!authentication.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Session invalid." }, { status: 401 });
    }

    // 1. Fetch active flashcards from database
    let flashcards = await (prisma as any).flashcard.findMany({
      orderBy: { createdAt: "desc" },
    });

    // 2. Auto-seed default cards if database table is currently empty
    if (flashcards.length === 0) {
      await (prisma as any).flashcard.createMany({
        data: DEFAULT_SEED_CARDS,
      });

      flashcards = await (prisma as any).flashcard.findMany({
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ success: true, flashcards });
  } catch (error: any) {
    console.error("[FLASHCARDS_FETCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to load flashcards.", details: error?.message },
      { status: 500 }
    );
  }
}
