const fs = require('fs');
const path = require('path');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const modelMatches = [...schema.matchAll(/model\s+(\w+)\s*\{/g)].map(m => m[1]);
console.log('Found models in schema.prisma:', modelMatches);

modelMatches.forEach((modelName) => {
  const modelRegex = new RegExp((model\\s+\\s*{[\\s\\S]*?)(}), 'g');
  schema = schema.replace(modelRegex, (match, p1, p2) => {
    if (p1.includes('deletedAt')) return match;
    console.log(Adding deletedAt/deletedBy to model: );
    return ${p1}  deletedAt  DateTime?\n  deletedBy  String?\n\n  @@index([deletedAt])\n;
  });
});

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Schema updated successfully.');