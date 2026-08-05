// src/app/api/admin/flashcards/bulk/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { flashcards } = await req.json();

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json(
        { message: 'No valid flashcards provided' },
        { status: 400 }
      );
    }

    // Insert into live database with dual mapping (question/answer & front/back)
    const result = await prisma.flashcard.createMany({
      data: flashcards.map((fc: any) => ({
        category: fc.category,
        topic: fc.topic || 'General',
        question: fc.question,
        answer: fc.answer,
        front: fc.front || fc.question, // Fallback for legacy components
        back: fc.back || fc.answer,     // Fallback for legacy components
        options: fc.options || [],
        explanation: fc.explanation || '',
        difficulty: fc.difficulty || 'medium',
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error: any) {
    console.error('Prisma Flashcard Bulk Insert Error:', error);
    return NextResponse.json(
      { message: error.message || 'Database insert failed' },
      { status: 500 }
    );
  }
}