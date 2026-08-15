import { prisma } from "../src/lib/prisma";

async function checkDbQuestions() {
  const allQuestions = await prisma.question.findMany({
    select: {
      id: true,
      category: true,
      subtopic: true,
      prompt: true,
      options: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      answerIndex: true,
      deletedAt: true,
      tags: true,
    }
  });

  console.log(`Total questions in DB: ${allQuestions.length}`);

  // Find all prompt duplicates in DB
  const map = new Map<string, typeof allQuestions>();
  for (const q of allQuestions) {
    const key = (q.prompt || "").trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(q);
  }

  let dupes = 0;
  for (const [key, group] of map.entries()) {
    if (group.length > 1) {
      dupes += (group.length - 1);
      console.log(`\nDUPE FOUND (${group.length}x):`);
      console.log(`Prompt: "${group[0].prompt.substring(0, 100)}"`);
      console.log(`DeletedAt: ${group.map(g => g.deletedAt).join(", ")}`);
      console.log(`IDs: ${group.map(g => g.id).join(", ")}`);
      console.log(`Tags: ${group.map(g => JSON.stringify(g.tags)).join(" | ")}`);
    }
  }

  console.log(`\nTotal duplicate DB questions found: ${dupes}`);

  // Also check if any question has exact same options AND same answer across any prompts
  const optsMap = new Map<string, typeof allQuestions>();
  for (const q of allQuestions) {
    const opts = (q.options && q.options.length > 0) ? q.options.join(" | ") : [q.optionA, q.optionB, q.optionC, q.optionD].join(" | ");
    const key = `${opts.toLowerCase()}:::${q.answerIndex}`;
    if (!optsMap.has(key)) optsMap.set(key, []);
    optsMap.get(key)!.push(q);
  }

  let sameChoicesDupes = 0;
  for (const [key, group] of optsMap.entries()) {
    if (group.length > 1 && !key.startsWith("true | false") && !key.startsWith("a | b | c")) {
      sameChoicesDupes++;
      console.log(`\nSAME CHOICES & ANSWER (${group.length}x):`);
      console.log(`Choices: ${key}`);
      group.forEach(g => {
        console.log(`  - [ID: ${g.id}] "${g.prompt?.substring(0, 90)}" (Cat: ${g.category}, Sub: ${g.subtopic})`);
      });
    }
  }
  console.log(`\nTotal same choices & answer groups: ${sameChoicesDupes}`);
}

checkDbQuestions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
