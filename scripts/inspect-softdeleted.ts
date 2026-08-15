import { prisma } from "../src/lib/prisma";

async function inspectSoftDeleted() {
  const softDeleted = await prisma.question.findMany({
    where: { NOT: { deletedAt: null } },
  });

  console.log(`Found ${softDeleted.length} soft-deleted questions in DB:`);
  for (const q of softDeleted) {
    console.log(`ID: ${q.id} | DeletedAt: ${q.deletedAt} | Cat: ${q.category} | Prompt: "${q.prompt?.substring(0, 80)}"`);
  }
}

inspectSoftDeleted()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
