// Relative Path: src/app/api/admin/questions/ai-generate/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StructuredQuestion } from "@/types/question";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId || session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      category = "Numerical Reasoning",
      subtopic = "Work & Rate",
      difficulty = "HARD",
      count = 5,
      includeDetailedSteps = true,
      includeOptionAnalysis = true,
      includeEliminationStrategy = true,
      includeCommonTrap = true,
      includeExamTip = true,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured in your environment (.env.local). Please configure it or use the offline prompt generator.",
        },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a Senior Civil Service Examination (CSE) Test Constructor and Subject Matter Expert in the Philippines.
Your mission is to generate ${count} high-quality, professional, realistic multiple-choice questions for Philippine Civil Service Examination review.

CATEGORY: ${category}
SUBTOPIC: ${subtopic}
DIFFICULTY: ${difficulty}

CRITICAL RULES:
1. Every question must have EXACTLY FOUR plausible options (Option A, Option B, Option C, Option D).
2. Exactly one option is correct. The correct answer index must be 0 (A), 1 (B), 2 (C), or 3 (D).
3. Distractors must represent realistic candidate errors (arithmetic trap, misapplied formula, inverted relationship, reversed polarity, conditional misinterpretation), NOT absurd or obvious jokes.
4. FOR NUMERICAL QUESTIONS: Double-check and verify all mathematics and calculations step-by-step.
5. FOR ANALYTICAL / LOGICAL QUESTIONS: Explicitly verify that all given conditions lead to ONE unambiguous answer.
6. FOR VERBAL QUESTIONS: Ensure strict grammatical, semantic, and contextual precision.
7. FOR GENERAL INFORMATION: Ensure strict factual accuracy aligned with the 1987 Philippine Constitution, RA 6713, and environmental/human rights laws.
8. DO NOT INCLUDE ANY HTML OR VISUAL FORMATTING TAGS. OUTPUT PURE STRUCTURED JSON ONLY.

JSON FORMAT SPECIFICATION:
Return a valid JSON array of objects with the following schema:
[
  {
    "category": "${category}",
    "subtopic": "${subtopic}",
    "prompt": "Question text here...",
    "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
    "optionA": "Choice A",
    "optionB": "Choice B",
    "optionC": "Choice C",
    "optionD": "Choice D",
    "answerIndex": 1,
    "explanation": "Clear summary explanation...",
    "stepByStep": "Step 1: ...|Step 2: ...|Step 3: ...",
    "whyA": "Why A is right or wrong...",
    "whyB": "Why B is right or wrong...",
    "whyC": "Why C is right or wrong...",
    "whyD": "Why D is right or wrong...",
    "eliminationStrategy": "Practical technique to eliminate wrong choices...",
    "commonTrap": "The specific misconception this question tests...",
    "examTip": "A practical test-taking tip for exam day...",
    "difficulty": "${difficulty}",
    "tags": ["${category.toLowerCase()}", "${subtopic.toLowerCase()}"]
  }
]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        }),
      }
    );

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("Gemini empty response:", data);
      return NextResponse.json({ error: "Gemini returned an empty response" }, { status: 500 });
    }

    let parsedQuestions: StructuredQuestion[] = [];
    try {
      const parsed = JSON.parse(rawText);
      parsedQuestions = Array.isArray(parsed) ? parsed : parsed.questions || [parsed];
    } catch (parseErr) {
      console.error("Failed to parse Gemini output:", rawText);
      return NextResponse.json({ error: "Failed to parse structured JSON from Gemini" }, { status: 500 });
    }

    // Clean and validate questions
    const sanitizedQuestions: StructuredQuestion[] = parsedQuestions
      .filter((q) => q.prompt && Array.isArray(q.options) && q.options.length >= 2)
      .map((q) => ({
        category: q.category || category,
        subtopic: q.subtopic || subtopic,
        prompt: q.prompt,
        options: q.options.slice(0, 4),
        optionA: q.optionA || q.options[0] || "",
        optionB: q.optionB || q.options[1] || "",
        optionC: q.optionC || q.options[2] || "",
        optionD: q.optionD || q.options[3] || "",
        answerIndex: typeof q.answerIndex === "number" ? Math.max(0, Math.min(3, q.answerIndex)) : 0,
        explanation: q.explanation || "",
        stepByStep: q.stepByStep || null,
        whyA: q.whyA || null,
        whyB: q.whyB || null,
        whyC: q.whyC || null,
        whyD: q.whyD || null,
        eliminationStrategy: q.eliminationStrategy || null,
        commonTrap: q.commonTrap || null,
        examTip: q.examTip || null,
        difficulty: q.difficulty || difficulty,
        tags: Array.isArray(q.tags) ? q.tags : [category, subtopic],
      }));

    return NextResponse.json({
      success: true,
      questions: sanitizedQuestions,
      count: sanitizedQuestions.length,
    });
  } catch (error) {
    console.error("AI Generate Questions error:", error);
    return NextResponse.json({ error: "Failed to generate questions via Gemini AI" }, { status: 500 });
  }
}
