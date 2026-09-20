// Relative Path: src/scripts/test-phase2-input-remediation.ts
import { formatPromptHTML } from "@/lib/formatPrompt";
import { renderPieChartSVG } from "@/lib/chartRenderer";
import { escapeHtml } from "@/lib/email";
import { generateQuestionsCSV } from "@/lib/csvParser";
import { StructuredQuestion } from "@/types/question";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
    failedCount++;
  }
}

console.log("\n=======================================================");
console.log("🛡️ PHASE 2B INPUT SECURITY REMEDIATION VERIFICATION SUITE");
console.log("=======================================================\n");

// -----------------------------------------------------------------------------
// 1. XSS Architecture & Prompt Formatter Tests
// -----------------------------------------------------------------------------
console.log("--- 1. Question Prompt XSS & Formatter Verification ---");

const xssPayloads = [
  '<script>alert(1)</script>',
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '<img/src=x/onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '<svg onload=alert(document.domain)>',
  '<svg/onload=alert(1)>',
  '<table onmouseover=alert(1)><tr><td>test</td></tr></table>',
  '<a href="javascript:alert(1)">Click here</a>',
  '<a href="javascript:alert(1)">test</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<details open ontoggle=alert(1)>',
  '📑 [TABLE]| Col 1 | Col 2 |<script>alert(1)</script>[/TABLE]',
];

for (const payload of xssPayloads) {
  const result = formatPromptHTML(payload);
  const containsActiveScript = /<script\b/i.test(result);
  const containsUnescapedImgOnerror = /<img[^>]*onerror/i.test(result);
  const containsUnescapedSvgOnload = /<svg[^>]*onload/i.test(result);
  const containsJavascriptScheme = /href\s*=\s*["']?javascript:/i.test(result);
  const containsUnescapedIframe = /<iframe[^>]*srcdoc/i.test(result);

  assert(
    !containsActiveScript && !containsUnescapedImgOnerror && !containsUnescapedSvgOnload && !containsJavascriptScheme && !containsUnescapedIframe,
    `Payload neutralized: ${payload.slice(0, 45)}...`,
    `Output contained dangerous markup: ${result.slice(0, 100)}`
  );
}

// Check safe table generation still functions for valid markdown
const tableInput = "Here is a data table:\n| City | Population |\n| Manila | 1.8M |\n| Quezon | 2.9M |";
const tableOutput = formatPromptHTML(tableInput);
assert(
  tableOutput.includes("<table") && tableOutput.includes("Manila") && tableOutput.includes("1.8M"),
  "Valid markdown tables are cleanly rendered into styled HTML tables"
);

// Check that arbitrary user tags inside table cells are escaped
const tableInjection = "| City | Status |\n| Manila | <img src=x onerror=alert(1)> |";
const tableInjOutput = formatPromptHTML(tableInjection);
assert(
  !/<img[^>]*onerror/i.test(tableInjOutput) && tableInjOutput.includes("&lt;img"),
  "User HTML inside markdown table cells is escaped into inert text"
);

// Check legitimate internally generated charts still render
const sampleChartData = [
  { label: "Passed", value: 75 },
  { label: "Failed", value: 25 },
];
const chartSvg = renderPieChartSVG("Exam Performance", sampleChartData);
assert(
  chartSvg.includes("<svg") && chartSvg.includes("Exam Performance") && chartSvg.includes("Passed"),
  "Legitimate internally generated SVG charts render cleanly and safely"
);

// -----------------------------------------------------------------------------
// 2. StudyPostCard JSX Safety Check
// -----------------------------------------------------------------------------
console.log("\n--- 2. StudyPostCard JSX Safety Verification ---");
const studyPostCardSrc = fs.readFileSync(
  path.join(process.cwd(), "src/components/social/commons/StudyPostCard.tsx"),
  "utf8"
);
assert(
  !studyPostCardSrc.includes("dangerouslySetInnerHTML"),
  "StudyPostCard does NOT use dangerouslySetInnerHTML anywhere"
);
assert(
  !studyPostCardSrc.includes("formatPromptHTML"),
  "StudyPostCard does NOT import or call formatPromptHTML"
);
assert(
  studyPostCardSrc.includes("{post.content}"),
  "StudyPostCard renders post.content as direct safe React JSX text"
);

// -----------------------------------------------------------------------------
// 3. Email HTML Injection Verification
// -----------------------------------------------------------------------------
console.log("\n--- 3. Transactional Email Escaping Verification ---");
const testEmailStrings = [
  { input: '<script>alert("xss")</script>', expected: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;" },
  { input: 'User & Co <test@example.com>', expected: "User &amp; Co &lt;test@example.com&gt;" },
  { input: '"quoted" & \'single\'', expected: "&quot;quoted&quot; &amp; &#39;single&#39;" },
];

for (const t of testEmailStrings) {
  const escaped = escapeHtml(t.input);
  assert(escaped === t.expected, `escapeHtml correctly encodes: ${t.input}`);
}

const emailSource = fs.readFileSync(path.join(process.cwd(), "src/lib/email.ts"), "utf8");
assert(
  emailSource.includes("verifyLink = escapeHtml(") && emailSource.includes("resetLink = escapeHtml("),
  "Auth verification and reset templates escape verifyLink and resetLink"
);
assert(
  emailSource.includes("partnerName = escapeHtml(params.partnerName)") &&
  emailSource.includes("setupUrl = escapeHtml(") &&
  emailSource.includes("resetUrl = escapeHtml("),
  "Partner email templates escape partnerName, setupUrl, and resetUrl"
);

// -----------------------------------------------------------------------------
// 4. CSV Formula Injection Neutralization
// -----------------------------------------------------------------------------
console.log("\n--- 4. CSV Formula Injection Verification ---");
const maliciousQuestions: StructuredQuestion[] = [
  {
    category: "=SUM(A1:B1)",
    subtopic: "+SUM(A1:B1)",
    prompt: "-HYPERLINK(\"http://attacker.com/malicious.csv\", \"click\")",
    options: ["@SUM(A1:A2)", "Normal Option", "Safe", "Safe"],
    optionA: "@SUM(A1:A2)",
    optionB: "Normal Option",
    optionC: "Safe",
    optionD: "Safe",
    answerIndex: 0,
    difficulty: "EASY",
    tags: ["=calc"],
  },
];

const generatedCSV = generateQuestionsCSV(maliciousQuestions);
assert(
  !generatedCSV.includes(',=SUM(A1:B1)') && generatedCSV.includes("'=SUM(A1:B1)"),
  "Formulas starting with '=' are prefixed with single quote in CSV export"
);
assert(
  !generatedCSV.includes(',+SUM(A1:B1)') && generatedCSV.includes("'+SUM(A1:B1)"),
  "Formulas starting with '+' are neutralized in CSV export"
);
assert(
  !generatedCSV.includes(',-HYPERLINK') && generatedCSV.includes("'-HYPERLINK"),
  "Formulas starting with '-' are neutralized in CSV export"
);
assert(
  !generatedCSV.includes(',@SUM(A1:A2)') && generatedCSV.includes("'@SUM(A1:A2)"),
  "Formulas starting with '@' are neutralized in CSV export"
);

// Verify that legitimate numeric negative values remain unmodified numbers
const numericTest = Papa.unparse([{ count: -15, score: -2.5 }], { escapeFormulae: true });
assert(
  numericTest.includes("-15") && numericTest.includes("-2.5") && !numericTest.includes("'-15"),
  "Legitimate numeric negative values remain unmodified numbers in CSV output"
);

// -----------------------------------------------------------------------------
// 5. Reading Materials Validation Logic Verification
// -----------------------------------------------------------------------------
console.log("\n--- 5. Reading Materials Security Controls Verification ---");
const readingApiSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/reading-materials/route.ts"),
  "utf8"
);
const readingFileApiSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/reading-materials/file/route.ts"),
  "utf8"
);

assert(
  readingApiSrc.includes("MAX_FILE_SIZE = 3 * 1024 * 1024"),
  "Reading materials enforces 3MB maximum file size limit"
);
assert(
  readingApiSrc.includes("4.5 * 1024 * 1024"),
  "Reading materials validates payload size before expensive buffer allocation"
);
assert(
  readingApiSrc.includes(".endsWith(\".pdf\")") &&
  readingApiSrc.includes(".endsWith(\".docx\")") &&
  readingApiSrc.includes(".endsWith(\".txt\")") &&
  readingApiSrc.includes(".doc is not supported"),
  "Reading materials strictly allows .pdf, .docx, .txt and rejects .doc"
);
assert(
  readingApiSrc.includes('Buffer.from("%PDF-")'),
  "Reading materials validates PDF %PDF- file signature"
);
assert(
  readingApiSrc.includes("0x50, 0x4b, 0x03, 0x04") &&
  readingApiSrc.includes("[Content_Types].xml") &&
  readingApiSrc.includes("word/document.xml"),
  "Reading materials validates DOCX PK\\x03\\x04 zip header and document structures"
);
assert(
  readingApiSrc.includes("function hasZipEntry") &&
  readingApiSrc.includes('hasZipEntry(buffer, "[Content_Types].xml")') &&
  readingApiSrc.includes('hasZipEntry(buffer, "word/document.xml")'),
  "Reading materials validates DOCX using true ZIP entry structure inspection"
);
assert(
  readingApiSrc.includes('new TextDecoder("utf-8", { fatal: true })') &&
  readingApiSrc.includes('\\0'),
  "Reading materials validates TXT utf-8 encoding and absence of null bytes"
);
assert(
  readingFileApiSrc.includes('"X-Content-Type-Options": "nosniff"'),
  "Reading materials file route includes X-Content-Type-Options: nosniff"
);
assert(
  readingFileApiSrc.includes('disposition = "attachment"') &&
  readingFileApiSrc.includes('replace(/[\\r\\n"\\\\/]/g, "_")'),
  "Reading materials file route sets attachment for non-PDFs and sanitizes filename"
);

// -----------------------------------------------------------------------------
// 6. API Input Bounds Verification
// -----------------------------------------------------------------------------
console.log("\n--- 6. API Input Bounds Verification ---");
const profileRouteSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/user/profile/route.ts"),
  "utf8"
);
assert(
  profileRouteSrc.includes("name.trim().length > 100"),
  "User profile bounds name to 1-100 characters"
);
assert(
  profileRouteSrc.includes("newPassword.length < 8 || newPassword.length > 128"),
  "User profile bounds newPassword to 8-128 characters"
);

const partnerProfileRouteSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/partner/portal/profile/route.ts"),
  "utf8"
);
assert(
  partnerProfileRouteSrc.includes("contactName.trim().length > 100") &&
  partnerProfileRouteSrc.includes("contactPhone.trim().length > 30") &&
  partnerProfileRouteSrc.includes("tagline.trim().length > 200") &&
  partnerProfileRouteSrc.includes("description.trim().length > 2000"),
  "Partner portal profile bounds contactName, contactPhone, tagline, description"
);
assert(
  partnerProfileRouteSrc.includes("isValidHttpUrl") &&
  partnerProfileRouteSrc.includes("trimmedFb.length > 500"),
  "Partner portal profile validates URL format and 500 char length limit for URLs"
);

const roomChatRouteSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/social/rooms/[roomId]/chat/route.ts"),
  "utf8"
);
assert(
  roomChatRouteSrc.includes("trimmedContent.length > 2000"),
  "Room chat bounds message content to 2000 characters after trim"
);

const dmRouteSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/social/messages/[conversationId]/route.ts"),
  "utf8"
);
assert(
  dmRouteSrc.includes("trimmedContent.length > 2000"),
  "DM messages bounds content to 2000 characters after trim"
);

const duelRouteSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/duels/[id]/route.ts"),
  "utf8"
);
assert(
  duelRouteSrc.includes("!isP1 && !isP2") &&
  duelRouteSrc.includes("Access denied: You are not a participant in this match"),
  "Duel match verifies caller is a player participant"
);
assert(
  duelRouteSrc.includes("questionIndex >= questions.length") &&
  duelRouteSrc.includes("selectedIndex >= optionsCount"),
  "Duel match bounds questionIndex and selectedIndex against match boundaries"
);

const supportRouteSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/support/route.ts"),
  "utf8"
);
assert(
  supportRouteSrc.includes("trimmedSubject.length > 200") &&
  supportRouteSrc.includes("trimmedMessage.length > 5000"),
  "Support tickets bound subject to 200 chars and message to 5000 chars"
);

const examDraftRouteSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/exam/draft/route.ts"),
  "utf8"
);
assert(
  examDraftRouteSrc.includes("rawAnswers.length > 100 * 1024") &&
  examDraftRouteSrc.includes("typeof parsedAnswers !== \"object\""),
  "Exam draft bounds answersJson to 100KB and validates JSON object structure"
);
assert(
  examDraftRouteSrc.includes("rawQuestions.length > 2 * 1024 * 1024") &&
  examDraftRouteSrc.includes("parsedQuestions.length > 500"),
  "Exam draft bounds questionsJson to 2MB and validates JSON array with <= 500 items"
);
assert(
  examDraftRouteSrc.includes("safeCurrentIndex > 500") &&
  examDraftRouteSrc.includes("safeTimeLeft > 86400"),
  "Exam draft bounds currentIndex (0-500) and timeLeft (0-86400)"
);

const importRouteSrc = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/admin/questions/import/route.ts"),
  "utf8"
);
assert(
  importRouteSrc.includes("request.formData()") &&
  importRouteSrc.includes("Unsupported media type"),
  "Admin questions import handles multipart form data and rejects unsupported types with 415"
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log("\n=======================================================");
console.log(`VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
