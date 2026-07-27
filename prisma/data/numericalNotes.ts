export const numericalNotesData = [
  {
    category: "Numerical Ability",
    title: "1. MDAS / PEMDAS Rule",
    summary: "Order of operations rule in mathematics. You cannot calculate left to right blindly.",
    content: [
      "Parenthesis: Solve what's inside first (also Brackets [] and Braces {}). Work inner to outer.",
      "Exponents: Powers and Roots come next (e.g., 4² = 16, √9 = 3).",
      "Multiplication OR Division: Tied in rank! Do NOT prioritize Multiply over Divide. Solve left to right as they appear.",
      "Addition OR Subtraction: Tied in rank! Solve left to right as they appear.",
      "Example 1: 16 ÷ 4 × 2 → Left to right: 16 ÷ 4 = 4, then 4 × 2 = 8. (NOT 16 ÷ 8 = 2).",
      "Example 2: 5 + 3 × 2 → Multiply first: 3 × 2 = 6. Then Add: 5 + 6 = 11."
    ],
    tips: "HACK: The 'MD' trap 10 ÷ 2 × 5. Many think 'M' comes first → 2 × 5 = 10 → 10 ÷ 10 = 1 (WRONG). Correct: 10 ÷ 2 = 5 → 5 × 5 = 25."
  },
  {
    category: "Numerical Ability",
    title: "2. Integers: Addition & Subtraction",
    summary: "Dealing with Positive (+) and Negative (-) numbers.",
    content: [
      "Same Sign: ADD the numbers and keep the sign. (-5 + -3 = -8, +7 + +2 = +9). Think: Adding more debt.",
      "Different Sign: SUBTRACT smaller from bigger, and copy the sign of the bigger number. (-10 + 3 = -7). Think: Paying off debt.",
      "Concept: Zero Pairs (+1 and -1 cancel each other out).",
      "Example 1: -8 + 12 = +4 (More money than debt).",
      "Example 2: 5 - 20 = -15 (Spending more than you have)."
    ],
    tips: "HACK: Money vs Debt logic (+Money, -Debt). May utang na 10 (-10), nagbayad ng 3 (+3). May utang pa ring 7 (-7). Don't memorize rules, visualize money!"
  },
  {
    category: "Numerical Ability",
    title: "3. Integers: Multiplication & Division",
    summary: "Rules for multiplying and dividing signed integers.",
    content: [
      "Same Sign: Result is always POSITIVE (+ × + = +) and (- × - = +). Example: -5 × -6 = +30.",
      "Different Sign: Result is always NEGATIVE (+ × - = -). Example: -10 ÷ 2 = -5.",
      "Odd number of negatives results in Negative. Even number of negatives results in Positive."
    ],
    tips: "HACK: Friend-Enemy Logic. Friend of my Friend = Friend (+). Enemy of my Enemy = Friend (+). Friend of my Enemy = Enemy (-)."
  },
  {
    category: "Numerical Ability",
    title: "4. Fractions: Addition & Subtraction",
    summary: "Adding and subtracting fractions with like or unlike denominators.",
    content: [
      "You CANNOT add/subtract fractions with different denominators (bottoms). They are like apples and oranges.",
      "Step 1: Find the LCD (Least Common Denominator).",
      "Step 2: Convert both fractions to equivalent fractions using the LCD.",
      "Step 3: Add/Subtract the numerators (tops) only. NEVER add the denominators.",
      "Example: 1/2 + 1/3 → LCD is 6. 3/6 + 2/6 = 5/6."
    ],
    tips: "HACK: Butterfly Method for 2 fractions. Multiply diagonals (wings) and add them for the new Top. Multiply bottoms for new Bottom: (1×3)+(2×1) / (2×3) = 5/6."
  },
  {
    category: "Numerical Ability",
    title: "5. Fractions: Multiplication",
    summary: "Multiplying fractions straight across.",
    content: [
      "The easiest operation in fractions. No need for LCD!",
      "Rule: Multiply Straight Across.",
      "Top × Top = New Top. Bottom × Bottom = New Bottom.",
      "Always simplify the final answer to lowest terms (reduce) by dividing both by their GCF.",
      "Example 1: 3/4 × 2/3 = 6/12. Simplify to 1/2.",
      "Example 2: 5 × 1/2 = 5/1 × 1/2 = 5/2 or 2.5."
    ],
    tips: "HACK: Cancel First! Before multiplying, check if a top number and a bottom number share a factor. 3/4 × 2/3 → Cancel 3s! Result is 2/4 → 1/2. Much faster."
  },
  {
    category: "Numerical Ability",
    title: "6. Fractions: Division (K.C.F.)",
    summary: "Dividing fractions using Keep, Change, Flip.",
    content: [
      "We do NOT divide fractions directly. We convert it to multiplication.",
      "K.C.F. = Keep, Change, Flip.",
      "1. KEEP the first fraction as is.",
      "2. CHANGE division (÷) to multiplication (×).",
      "3. FLIP the second fraction (take the reciprocal). Then multiply straight.",
      "Example 1: 2/3 ÷ 1/2 → 2/3 × 2/1 = 4/3 or 1 1/3.",
      "Example 2: 5 ÷ 1/2 → 5/1 × 2/1 = 10."
    ],
    tips: "HACK: Reciprocal rule: 2/3 ÷ 1/2 becomes 2/3 × 2/1. Answer: 4/3 or 1.33."
  },
  {
    category: "Numerical Ability",
    title: "7. Decimals to Percent",
    summary: "Converting decimal values to percentages.",
    content: [
      "Converting decimals to percent is just moving the decimal point.",
      "Rule: Move the decimal point 2 places to the RIGHT and add the % symbol.",
      "Example: 0.75 → 7.5 → 75%.",
      "Example: 1.2 → 12.0 → 120%.",
      "Example: 0.005 → 0.05 → 0.5%.",
      "Note: % literally means 'per 100'."
    ],
    tips: "HACK: D to P (Decimal to Percent) goes RIGHT →. Think: Alphabetical order D comes before P, so you move forward (Right)."
  },
  {
    category: "Numerical Ability",
    title: "8. Percent to Decimals",
    summary: "Converting percentage values to decimals.",
    content: [
      "Essential for calculations (calculators use decimals, not %).",
      "Rule: Move the decimal point 2 places to the LEFT and remove the % symbol.",
      "Example: 80% → 8.0 → 0.80 = 0.8.",
      "Example: 5% → 0.5 → 0.05 (Add zero placeholder).",
      "Example: 125% → 1.25."
    ],
    tips: "HACK: P to D goes LEFT ←. Percent to Decimal. Think: Moving 'Back' to the basics (decimals)."
  },
  {
    category: "Numerical Ability",
    title: "9. Finding Percentage (P = B × R)",
    summary: "Calculating the Percentage (Part) from Base and Rate.",
    content: [
      "The most common percentage problem type. Finding the 'Part'.",
      "Formula: Percentage = Base × Rate",
      "Question: 'What is 20% of 50?'",
      "Identify: Base = 50 (The Whole/Total). Rate = 0.20 (Has %). Percentage = Unknown.",
      "Example: 15% of 200 → 0.15 × 200 = 30."
    ],
    tips: "HACK: The word 'OF' usually means Multiply. 20% OF 50 → 0.20 × 50 = 10. Easy points!"
  },
  {
    category: "Numerical Ability",
    title: "10. Finding Rate (R = P / B)",
    summary: "Calculating the Rate (Percentage) given Part and Base.",
    content: [
      "Looking for the percent (%).",
      "Question: '5 is what percent of 20?'",
      "Formula: Rate = Percentage / Base",
      "Tip: The number after 'of' is usually the Base (Denominator). The result is a decimal, convert to %.",
      "Example: 40 is what percent of 50? 40/50 = 4/5 = 0.8 = 80%."
    ],
    tips: "HACK: 'IS over OF'. (5 is) / (of 20) = 5/20 = 1/4 = 0.25 = 25%. Always IS/OF."
  },
  {
    category: "Numerical Ability",
    title: "11. Finding Base (B = P / R)",
    summary: "Calculating the Base (Total) from Part and Rate.",
    content: [
      "Looking for the 'whole' amount or total.",
      "Question: '15 is 30% of what number?'",
      "Formula: Base = Percentage / Rate",
      "Logic: If a part is 15, the whole MUST be bigger than 15.",
      "Example: 50 is 25% of what? 50 / 0.25 = 200."
    ],
    tips: "HACK: Divide the Part by the Decimal Rate. 15 / 0.30 → Move decimal → 150 / 3 = 50."
  },
  {
    category: "Numerical Ability",
    title: "12. Percent Increase / Decrease",
    summary: "Calculating percentage changes between two values.",
    content: [
      "Calculating the relative change between two values.",
      "Formula: ((New - Old) / Old) × 100%",
      "If result is positive = Increase. If negative = Decrease.",
      "Example: Price went from 100 to 120. (120 - 100)/100 = 20/100 = 20%.",
      "Example: Weight went from 80kg to 64kg. (64 - 80)/80 = -16/80 = -0.25 = -25% (Decrease)."
    ],
    tips: "HACK: 'Change over Original'. Always divide by the OLD value (Starting point), never the new one."
  },
  {
    category: "Numerical Ability",
    title: "13. Age Problems",
    summary: "Solving age word problems across different time periods.",
    content: [
      "Calculating ages in Past, Present, and Future.",
      "Step 1: Create a Table with columns for Past (-), Present, Future (+).",
      "Step 2: Let x be the age of the YOUNGEST person to avoid fractions.",
      "Key Logic: The Age Difference between two people is CONSTANT forever. If Dad is 20 years older now, he is 20 years older in 10 years.",
      "Example: Ben is twice as old as Anna. Anna is 10. How old is Ben? Ben = 2 × 10 = 20."
    ],
    tips: "HACK: Translate phrase-by-phrase. 'Father is 3 times Son' → F = 3x, S = x. 'In 10 years' → F + 10, S + 10. Equation: (3x + 10) = 2(x + 10). Solve x."
  },
  {
    category: "Numerical Ability",
    title: "14. Work Problems (2 People)",
    summary: "Solving joint work completion rates with 2 workers.",
    content: [
      "Scenario: Person A takes X hours alone. Person B takes Y hours alone. How long if they work together?",
      "Concept: Rates add up. They don't add time! (Working together is FASTER).",
      "Shortcut Formula: Product / Sum = (X × Y) / (X + Y)",
      "Long Method: 1/T_total = 1/A + 1/B",
      "Example: A takes 4 hours, B takes 4 hours. Together? (4×4)/(4+4) = 16/8 = 2 hours."
    ],
    tips: "HACK: Product over Sum: A=3hrs, B=6hrs. (3×6)/(3+6) = 18/9 = 2 hours. ONLY works for 2 people."
  },
  {
    category: "Numerical Ability",
    title: "15. Work Problems (3+ People / Pipes)",
    summary: "Solving multi-worker or inlet/outlet pipe rate problems.",
    content: [
      "For 3 or more workers, Product/Sum does NOT work accurately.",
      "Method: Reciprocal Addition.",
      "Formula: 1/T = 1/A + 1/B + 1/C",
      "Pipes: If a pipe is emptying the tank (Leak/Outlet), subtract its rate (- 1/Leak).",
      "Example: Pipe A fills in 2h, Pipe B in 3h. 1/T = 1/2 + 1/3 = 5/6. T = 6/5 = 1.2 hours."
    ],
    tips: "HACK: 'Flip-Add-Flip'. 1. Flip times to rates (1/2, 1/3). 2. Add fractions (LCD). 3. Flip the final answer back to time."
  },
  {
    category: "Numerical Ability",
    title: "16. Mixture Problems",
    summary: "Combining two solutions with different concentrations.",
    content: [
      "Mixing two solutions (Acid, Alcohol, Salt) with different concentrations.",
      "Formula: (V1)(%1) + (V2)(%2) = (V_total)(%_new)",
      "Pure Substance: Concentration is 100% (or 1.0).",
      "Pure Water/Solvent: Concentration is 0% (or 0.0).",
      "Example: Mix 10L of 50% acid with 10L of 100% acid. (10)(0.5) + (10)(1.0) = 20(x) → 5 + 10 = 20x → x = 15/20 = 75%."
    ],
    tips: "HACK: Box Method. Draw 3 boxes. Amount × % in each. Box 1 + Box 2 = Box 3. It becomes a simple linear equation."
  },
  {
    category: "Numerical Ability",
    title: "17. Motion (Opposite Direction)",
    summary: "Objects moving toward each other or away from each other.",
    content: [
      "Two objects moving towards each other (collision course) or away from each other.",
      "Concept: They cover the distance together/combining efforts.",
      "Rule: ADD the speeds.",
      "Formula: Time = Total Distance / (Speed1 + Speed2)",
      "Example: Car A (60kph) meets Car B (40kph). Distance 200km. T = 200 / (60+40) = 200/100 = 2 hours."
    ],
    tips: "HACK: Opposite = Add. Think: Head-on collision logic. The gap closes extremely fast because both are moving."
  },
  {
    category: "Numerical Ability",
    title: "18. Motion (Same Direction)",
    summary: "Chasing or overtaking motion scenarios.",
    content: [
      "Chasing or Overtaking scenarios. One starts behind.",
      "Concept: The chaser must be faster to catch up. The 'gap' closes slowly.",
      "Rule: SUBTRACT the speeds (Relative Speed).",
      "Formula: Time = Distance Gap / (Fast Speed - Slow Speed)",
      "Example: Thief (80kph), Police (100kph). Gap is 20km. T = 20 / (100-80) = 20/20 = 1 hour."
    ],
    tips: "HACK: Same = Subtract. Think: Traffic. Even if you drive 100kph, if the car ahead is 90kph, you only gain 10mph on him."
  },
  {
    category: "Numerical Ability",
    title: "19. Distance-Speed-Time (D = ST)",
    summary: "Fundamental motion formulas and unit consistency.",
    content: [
      "The fundamental motion formula.",
      "Distance = Speed × Time",
      "Speed = Distance / Time",
      "Time = Distance / Speed",
      "Consistency Check: Ensure units match! (km/h needs km and hours, not minutes).",
      "Example: Car travels 60kph for 3 hours. D = 60 × 3 = 180km."
    ],
    tips: "HACK: Triangle Method (DST). Cover 'D', you see S × T. Cover 'S', you see D/T. Cover 'T', you see D/S."
  },
  {
    category: "Numerical Ability",
    title: "20. Simple Interest (I = PRT)",
    summary: "Calculating interest earned or paid over time.",
    content: [
      "Calculating interest earned or paid over time.",
      "Formula: I = Prt",
      "P = Principal (Original Money), r = Rate (convert % to decimal), t = Time (MUST be in Years).",
      "Trap: If time is given in months, divide by 12.",
      "Example: P = 2000, r = 5% (0.05), t = 3 years. I = 2000 × 0.05 × 3 = 300."
    ],
    tips: "HACK: 'I Pretty'. 18 months? That's 1.5 years. 6 months? 0.5 years. Always convert 't' to years first!"
  },
  {
    category: "Numerical Ability",
    title: "21. Total Amount (A = P + I)",
    summary: "Finding total maturity value of an investment or loan.",
    content: [
      "Finding the final maturity value.",
      "Formula: Amount = Principal + Interest",
      "Shortcut: A = P(1 + rt)",
      "Compound Interest (Rare): A = P(1 + r)^t. Money grows faster."
    ],
    tips: "HACK: Don't forget the Principal if asking for 'Total Payback', it's P + I. If 'Just Interest', it's I."
  },
  {
    category: "Numerical Ability",
    title: "22. Discount Series (Successive)",
    summary: "Calculating successive discounts accurately.",
    content: [
      "Successive discounts (e.g., 20% off, then additional 10% off).",
      "Common Mistake: Adding them (20 + 10 = 30% is WRONG!). The second discount applies to the ALREADY discounted price.",
      "Method: Multiply the 'Paying Percentages' complements.",
      "Example: Shirt is 1000. 20% off → 800. Then 10% off 800 → 80 discount. Final Price 720."
    ],
    tips: "HACK: Pay Rates. 0.8 × 0.9 = 0.72. You pay 72%. Total discount is 100 - 72 = 28%. (Always less than simple sum)."
  },
  {
    category: "Numerical Ability",
    title: "23. Mark-Up & Margin",
    summary: "Differentiating Mark-Up percentage and Profit Margin.",
    content: [
      "Mark-up: Percentage added to Cost to get Selling Price. Based on Cost.",
      "Margin: Percentage of profit in the Selling Price. Based on Selling Price.",
      "Formula: Selling Price = Cost + Mark-up",
      "Mark-up % = Profit / Cost. Margin % = Profit / Selling Price.",
      "Example: Cost 100, Sell 150. Profit 50. Mark-up = 50/100 = 50%. Margin = 50/150 = 33.3%."
    ],
    tips: "HACK: Mark-up = Cost basis (C). Margin = Selling basis (S). Alphabetical: Cost comes before Selling."
  },
  {
    category: "Numerical Ability",
    title: "24. Ratio: Partitive Proportion",
    summary: "Dividing a quantity into proportional parts.",
    content: [
      "Dividing a number into proportional parts (e.g., Divide 1000 in ratio 2:3:5).",
      "Step 1: Add ratios to get Total Parts (2 + 3 + 5 = 10 parts).",
      "Step 2: Divide Total Amount by Total Parts (1000 / 10 = 100 per part).",
      "Step 3: Multiply Unit Value by each ratio (200, 300, 500).",
      "Example: Divide 50 apples in ratio 2:3. Sum = 5. Unit = 50/5 = 10. Parts are 20 and 30."
    ],
    tips: "HACK: 'Sum, Divide, Multiply'. Add parts, get value of one part (unit), then distribute."
  },
  {
    category: "Numerical Ability",
    title: "25. Direct Proportion",
    summary: "Proportional relationships where both variables increase together.",
    content: [
      "When one quantity increases, the other also increases.",
      "Example: More petrol, more distance. More workers, more output.",
      "Format: y = kx",
      "Solve: x1/y1 = x2/y2 (Ratio 1 = Ratio 2).",
      "Example: 3 pens cost 45. 5 pens cost? 45/3 = 15 each. 15 × 5 = 75."
    ],
    tips: "HACK: 'Cross Multiply'. If 3 apples = 30 pesos, then 5 apples = x pesos. 3/30 = 5/x → 3x = 150 → x = 50."
  },
  {
    category: "Numerical Ability",
    title: "26. Inverse Proportion",
    summary: "Relationships where one variable increases as the other decreases.",
    content: [
      "When one quantity increases, the other decreases.",
      "Example: More workers, LESS time needed. Faster speed, LESS travel time.",
      "Format: xy = k (Product is constant).",
      "Solve: x1·y1 = x2·y2.",
      "Example: 4 men finish in 6 days. 8 men? (4 × 6) = 24 total mandays. 24 / 8 = 3 days."
    ],
    tips: "HACK: 'Multiply Straight'. 4 workers × 10 days = 40 'man-days'. If you have 10 workers? 15 × d = 60 → d = 4."
  },
  {
    category: "Numerical Ability",
    title: "27. Number Series: Arithmetic",
    summary: "Sequences with a constant addition/subtraction gap.",
    content: [
      "A sequence where the difference between terms is constant.",
      "Operation: Addition or Subtraction.",
      "Example: 2, 5, 8, 11, 14... (Common Difference = +3).",
      "Tip: Calculate the gap between neighbors. If gap is constant, it's Arithmetic."
    ],
    tips: "HACK: Look for the 'Gap'. If the gap is constant (e.g., +3, +3, +3), just add it to the last term."
  },
  {
    category: "Numerical Ability",
    title: "28. Number Series: Geometric",
    summary: "Sequences with a constant multiplication/division ratio.",
    content: [
      "A sequence where the ratio between terms is constant.",
      "Operation: Multiplication or Division.",
      "Example: 3, 6, 12, 24, 48... (Common Ratio = ×2).",
      "Tip: Numbers grow (explode) or shrink very fast."
    ],
    tips: "HACK: 'Multiplier Hunt'. Try dividing the 2nd term by the 1st. If 6/3 = 2 and 12/6 = 2, the rule is ×2."
  },
  {
    category: "Numerical Ability",
    title: "29. Number Series: Alternating",
    summary: "Sequences containing two interleaved sub-patterns.",
    content: [
      "Two different patterns interleaved in one series.",
      "Example: 10, 2, 12, 4, 14, 6...",
      "Series A (Odd positions): 10, 12, 14 (+2).",
      "Series B (Even positions): 2, 4, 6 (+2)."
    ],
    tips: "HACK: Look for 'Up-Down-Up-Down' behavior. 'Skip Hop' if the series zigzags, ignore neighbors and look at every other number (1st, 3rd, 5th)."
  },
  {
    category: "Numerical Ability",
    title: "30. Number Series: Fibonacci-Type",
    summary: "Sequences where each term is the sum of previous terms.",
    content: [
      "Each term is the sum of the previous two terms.",
      "Classic: 1, 1, 2, 3, 5, 8, 13, 21...",
      "Logic: 1+1=2, 1+2=3, 2+3=5, 3+5=8.",
      "Variation: Lucas Numbers (2, 1, 3, 4, 7...)."
    ],
    tips: "HACK: Add the last two. If finding the next number is hard, try adding the previous two numbers together."
  },
  {
    category: "Numerical Ability",
    title: "31. Consecutive Integers",
    summary: "Sequences of integers following one after another.",
    content: [
      "Integers that follow each other in order (x, x+1, x+2...).",
      "Problem: 'Sum of 3 consecutive integers is 33.'",
      "Shortcut: Sum / Count (33 ÷ 3 = 11).",
      "The result is ALWAYS the Middle Number (Median).",
      "Example: Sum is 33, 3 integers. Middle is 11. Numbers: 9, 10, 11."
    ],
    tips: "HACK: 33 ÷ 3 = 11 (Middle). So numbers are 10, 11, 12. If asked for largest? 12. Smallest? 10. Fastest way!"
  },
  {
    category: "Numerical Ability",
    title: "32. Even & Odd Number Rules",
    summary: "Properties of arithmetic operations on even and odd numbers.",
    content: [
      "Addition: Like signs = Even (E + E = E, O + O = E). Mixed = Odd (E + O = O).",
      "Multiplication: If ANY factor is Even, the product is Even. O × O = O.",
      "Divisibility: Even numbers end in 0, 2, 4, 6, 8.",
      "Prime Numbers: 2 is the ONLY even prime number.",
      "Example: Odd(3) + Even(2) = 5 (Odd)."
    ],
    tips: "HACK: Plug in numbers. E + O? Try 2 + 1 = 3 (Odd). E × E? Try 2 × 2 = 4 (Even). Don't memorize, just use small numbers."
  },
  {
    category: "Numerical Ability",
    title: "33. Divisibility Rules",
    summary: "Quick tests to determine if a number is divisible by 2, 3, 4, 5, 6, or 9.",
    content: [
      "By 2: Ends in 0, 2, 4, 6, 8.",
      "By 3: Sum of digits divisible by 3 (123 → 1 + 2 + 3 = 6 Ys).",
      "By 4: Last 2 digits divisible by 4 (e.g., ...12, ...24).",
      "By 5: Ends in 0 or 5.",
      "By 6: Divisible by BOTH 2 and 3.",
      "By 9: Sum of digits divisible by 9."
    ],
    tips: "HACK: Example: Is 51 divisible by 3? 5 + 1 = 6. Yes. For 3 and 9, just add the digits. If the sum works, the big number works!"
  },
  {
    category: "Numerical Ability",
    title: "34. Probability (Basic)",
    summary: "Calculating likelihood of simple chance events.",
    content: [
      "The likelihood of an event happening.",
      "Formula: Desired Outcomes / Total Possible Outcomes",
      "Coin Flip: 1 Head / 2 Sides = 50%.",
      "Dice: Roll > 4 (5, 6) → 2 numbers / 6 total = 1/3.",
      "Deck of Cards: 52 total. 4 Suits. 13 Ranks.",
      "Example: Bag has 3 Red, 2 Blue. Pick Blue? 2/5 = 40%."
    ],
    tips: "HACK: Count the Winners (top) over Count All (bottom). 0 = Impossible, 1 = Certain."
  },
  {
    category: "Numerical Ability",
    title: "35. Probability (AND vs OR)",
    summary: "Combining probabilities of multiple events.",
    content: [
      "Dealing with multiple events.",
      "AND Rule: (Independent) Multiply probabilities. P(A AND B) = P(A) × P(B).",
      "OR Rule: (Mutually Exclusive) Add probabilities. P(A OR B) = P(A) + P(B).",
      "Example: Coin HEAD (1/2) AND Dice 6 (1/6) = 1/12."
    ],
    tips: "HACK: AND = Multiply (Harder, chance gets smaller). OR = Add (Easier, chance gets bigger)."
  },
  {
    category: "Numerical Ability",
    title: "36. Permutation (Order Matters)",
    summary: "Arrangements where position or sequence is vital.",
    content: [
      "Arrangement of items where Sequence/Order is vital.",
      "Keywords: Rank, Position, Password, Code, Titles (Pres, VP), Schedules.",
      "Formula: nPr = n! / (n - r)!",
      "Example: Top 3 winners in a race of 10. (Gold, Silver, Bronze are different)."
    ],
    tips: "HACK: 'P' for Position/Password. 1-2-3 is different from 3-2-1. If swapping changes the meaning, it's Permutation."
  },
  {
    category: "Numerical Ability",
    title: "37. Combination (Order Doesn't Matter)",
    summary: "Selections where group membership matters, not order.",
    content: [
      "Selection of items where Sequence is irrelevant.",
      "Keywords: Committee, Team, Group, Handshake, Ingredients, Lotto.",
      "Formula: nCr = n! / (r!(n - r)!)",
      "Example: Picking 3 friends to go to the mall. {A,B,C is same group as C,B,A}."
    ],
    tips: "HACK: 'C' for Committee/Collection. Swapping members doesn't change the team. Denominator is bigger, so answer is smaller than Permutation."
  },
  {
    category: "Numerical Ability",
    title: "38. Mean (Average)",
    summary: "Calculating arithmetic average and weighted mean.",
    content: [
      "The most common measure of central tendency.",
      "Formula: Mean = Sum of all values / Number of values",
      "Weighted Mean: Used for grades = Σ(Units × Grade) / Total Units",
      "Sensitive to outliers (extreme high/lows pull the average).",
      "Example: 1, 2, 3. Mean = 6 / 3 = 2."
    ],
    tips: "HACK: 'Balance Point'. If you have 80, 85, 90. The average is exactly in the middle (85). If not evenly spaced, Add All / Count All."
  },
  {
    category: "Numerical Ability",
    title: "39. Median (Middle Value)",
    summary: "Finding the middle value in an ordered data set.",
    content: [
      "The middle value when data is arranged in Order (Low to High).",
      "Odd count: Exact middle number.",
      "Even count: Average of the two middle numbers.",
      "Best used when there are extreme outliers (e.g., salary data).",
      "Example: 10, 20, 30, 40. Median is average of 20 and 30 = (20+30)/2 = 25."
    ],
    tips: "HACK: 'Sort First!'. Never find median without arranging numbers. If 2 middle numbers, meet halfway."
  },
  {
    category: "Numerical Ability",
    title: "40. Mode (Most Frequent)",
    summary: "Identifying the most frequently occurring value.",
    content: [
      "The value that appears most often in a data set.",
      "Example: 2, 3, 3, 5, 7 → Mode = 3.",
      "Bimodal: Two modes. Multimodal: Many modes.",
      "No Mode: If all numbers are unique."
    ],
    tips: "HACK: 'Popularity Contest'. Who has the most votes (appearances)? That's the mode."
  },
  {
    category: "Numerical Ability",
    title: "41. Clock Problems (Angle Formula)",
    summary: "Calculating the angle between clock hands.",
    content: [
      "Calculating the angle between Hour and Minute hands.",
      "Formula: Angle = |30H - 5.5M|",
      "Where does 5.5 come from? Minute hand moves 6°/min, Hour hand moves 0.5°/min. Diff is 5.5°.",
      "H = Hour (1-12), M = Minute (0-59).",
      "Example: 3:00, H=3, M=0. |30(3) - 0| = 90°."
    ],
    tips: "HACK: Memorize |30H - 5.5M|. 2:00 → 30(2) - 0 = 60°. 3:30 → |30(3) - 5.5(30)| = |90 - 165| = 75°."
  },
  {
    category: "Numerical Ability",
    title: "42. Venn Diagrams (Set Theory)",
    summary: "Visualizing set overlaps and union/intersection formulas.",
    content: [
      "Visual representation of sets.",
      "Formula for 2 Sets: Total = (A + B) - Both + Neither",
      "Why subtract 'Both'? Because you counted them twice (once in A, once in B).",
      "Intersection (∩): AND. Union (∪): OR.",
      "Example: 10 like A, 10 like B, 5 like Both. Total = 10 + 10 - 5 = 15."
    ],
    tips: "HACK: 'Double Count Fix'. Add the individual groups. Subtract the overlap to fix the double counting."
  },
  {
    category: "Numerical Ability",
    title: "43. Square Roots & Perfect Squares",
    summary: "List of perfect squares and estimating non-perfect roots.",
    content: [
      "A perfect square gives a whole number when rooted.",
      "List: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169 (13²)",
      "Estimation: √50? It's close to √49 (7), so approx 7.1."
    ],
    tips: "HACK: Sandwich Method. Find the perfect squares above and below. The answer is in between."
  },
  {
    category: "Numerical Ability",
    title: "44. Exponent Rules",
    summary: "Core rules for operating on exponents.",
    content: [
      "Product Rule: x^a · x^b = x^(a+b) (ADD exponents).",
      "Quotient Rule: x^a / x^b = x^(a-b) (SUBTRACT exponents).",
      "Power Rule: (x^a)^b = x^(a·b) (MULTIPLY exponents).",
      "Zero Exponent: x^0 = 1.",
      "Example: 2³ × 2² = 2⁵ = 32. (8 × 4 = 32)."
    ],
    tips: "HACK: MADSPM. Multiply-Add, Divide-Subtract, Power-Multiply. Memorize the pairs!"
  },
  {
    category: "Numerical Ability",
    title: "45. Data Interpretation (Graphs)",
    summary: "Reading pie charts, line graphs, and bar graphs.",
    content: [
      "Reading visual data.",
      "Pie Chart: Parts of a whole (100%).",
      "Line Graph: Trends over time (slope matters).",
      "Bar Graph: Comparisons of magnitude.",
      "Trap: Check the Axis start point (is it 0?) and Units.",
      "Example: If Bar A is twice as tall as Bar B, value A is twice value B."
    ],
    tips: "HACK: Read titles, axes, and legends FIRST before looking at questions."
  },
  {
    category: "Numerical Ability",
    title: "46. Perimeter & Area",
    summary: "Formulas for 2D geometry perimeter and area.",
    content: [
      "Perimeter: Distance AROUND a shape. (Fencing). Add all sides.",
      "Area: Space INSIDE a shape. (Tiling/Painting). Squared units.",
      "Rectangle: P = 2(L + W), A = L × W.",
      "Square: P = 4s, A = s².",
      "Triangle: A = 1/2 × base × height.",
      "Example: A room is 5m by 4m. P = 2(5 + 4) = 18m. A = 5 × 4 = 20m²."
    ],
    tips: "HACK: Fencing = Perimeter (Add sides). Flooring/Tiling = Area (Multiply). Circle C = 2πr (Cherry Pie is Delicious), A = πr² (Apple Pie are Squared)."
  },
  {
    category: "Numerical Ability",
    title: "47. Volume (3D Shapes)",
    summary: "Calculating 3D volume capacities.",
    content: [
      "The amount of space a 3D object occupies (Capacity).",
      "Rectangular Prism (Box): V = L × W × H.",
      "Cube: V = s³ (side × side × side).",
      "Cylinder: V = πr²h (Area of circle base × height).",
      "Measured in Cubic Units (cm³, m³).",
      "Example: A box is 10cm × 5cm × 2cm. V = 10 × 5 × 2 = 100cm³."
    ],
    tips: "HACK: For most boxes/prisms: Area of Base × Height. Washing for water level: Volume / Area of Base = Height."
  },
  {
    category: "Numerical Ability",
    title: "48. The Pythagorean Theorem",
    summary: "Right-triangle hypotenuse and legs relationship.",
    content: [
      "Used only for Right Triangles (has a 90° corner).",
      "Formula: a² + b² = c²",
      "c is the Hypotenuse (Longest side, opposite the right angle).",
      "Used for ladders leaning on walls, diagonals of screens/fields, shortcuts.",
      "Example: Sides are 3 and 4. c² = 3² + 4² = 9 + 16 = 25 → c = √25 = 5."
    ],
    tips: "HACK: Memorize 'Pythagorean Triples' to skip computing! 3-4-5, 5-12-13, 8-15-17. If sides are 6 and 8? It's a 3-4-5 multiplied by 2. Hypotenuse = 10."
  },
  {
    category: "Numerical Ability",
    title: "49. Metric Conversions",
    summary: "Converting units in the metric system.",
    content: [
      "Standard system of measurement.",
      "Sequence: Kilo - Hecto - Deka - UNIT - Deci - Centi - Milli.",
      "Unit can be Meter (Length), Gram (Mass), Liter (Volume).",
      "Each step is a factor of 10.",
      "Example: Convert 5km to meters. Kilo to Unit is 3 steps Right. 5.000 → 5000m."
    ],
    tips: "HACK: 'King Henry Died By Drinking Chocolate Milk': K-H-D-B-D-C-M. To convert, just count the steps and move the decimal point in the SAME direction."
  },
  {
    category: "Numerical Ability",
    title: "50. Angles & Triangles",
    summary: "Angle classifications and triangle sum rules.",
    content: [
      "Complementary Angles: Sum is 90° (Corner).",
      "Supplementary Angles: Sum is 180° (Straight Line).",
      "Sum of Angles in a Triangle: Always 180°.",
      "Example: In a triangle, angles are 50° and 60°. The third angle is 180 - (50 + 60) = 70°."
    ],
    tips: "HACK: C comes before S. 90 comes before 180. Complementary = 90. Supplementary = 180. Triangle? 180 ALWAYS."
  }
];