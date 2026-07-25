import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, userChoice, correctChoice, officialExplanation, category } = body;

    if (!prompt || !userChoice || !correctChoice) {
      return NextResponse.json({ error: "Missing required question parameters" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 💡 Option 1: Gemini 1.5 Flash AI Integration
    if (apiKey) {
      try {
        const aiPrompt = `You are an expert Civil Service Exam AI Tutor.
A student chose an incorrect option for a ${category || "General"} question.
Question: "${prompt}"
Student's Chosen Wrong Choice: "${userChoice}"
Correct Answer: "${correctChoice}"
Official Explanation: "${officialExplanation || "N/A"}"

In 2 short, encouraging sentences, pinpoint the exact logical trap or misconception in the student's choice ("${userChoice}") and why "${correctChoice}" is the proper answer.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: aiPrompt }] }],
            }),
          }
        );

        const data = await response.json();
        const aiExplanation = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiExplanation) {
          return NextResponse.json({ success: true, explanation: aiExplanation });
        }
      } catch (geminiErr) {
        console.error("Gemini API error, executing fallback:", geminiErr);
      }
    }

    // 💡 Option 2: Fallback Logic Engine
    const fallback = `You selected "${userChoice}". The correct choice is "${correctChoice}". ${
      officialExplanation ? `Key Concept: ${officialExplanation}` : "Make sure to double-check key qualifiers and formula steps."
    }`;

    return NextResponse.json({ success: true, explanation: fallback });
  } catch (error) {
    console.error("AI Explain Mistake Error:", error);
    return NextResponse.json({ error: "Failed to generate AI analysis" }, { status: 500 });
  }
}