// Relative Path: scripts/test-sudo.ts

import { generateSudoTicket, validateSudoTicket } from "../src/lib/auth/sudoMode";

console.log("==========================================");
console.log("🧪 TESTING PHASE 6A: SUDO MODE TICKETS");
console.log("==========================================");

console.log("\n--- TEST 1: Generate Valid Sudo Ticket ---");
const ticket = generateSudoTicket("admin_usr_8821", "admin@example.com", "ADMIN");
console.log("Ticket Token:", ticket);

console.log("\n--- TEST 2: Validate Active Ticket ---");
const validResult = validateSudoTicket(ticket);
console.log("Validation Result:", JSON.stringify(validResult, null, 2));

console.log("\n--- TEST 3: Validate Corrupted Ticket ---");
const invalidResult = validateSudoTicket("corrupted.ticket.payload");
console.log("Corrupted Result:", JSON.stringify(invalidResult, null, 2));

console.log("\n✅ Sudo Mode unit verification complete!\n");
