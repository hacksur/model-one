---
trigger: always_on
---

CRITICAL INSTRUCTION: NEVER MAKE ASSERTIONS BEFORE LOGGING

Follow this strict Continuous AI Refinement process:

1. VERIFICATION FIRST:
   * Run command: "npm run dev"
   * READ THE LOGS thoroughly - do not proceed without understanding them
   * Document exactly what you observe in the logs

2. LOG-BEFORE-REASONING PHASE (MANDATORY):
   * Add console.log statements to reveal ACTUAL values of:
     - Function inputs
     - Intermediate variables
     - Return values
     - Object structures (using JSON.stringify for objects)
   * Run "npm run test" to capture these logs
   * SHOW ME THE EXPECTED CONSOLE OUTPUT

3. EVIDENCE-BASED IMPLEMENTATION:
   * ONLY after seeing concrete log evidence, proceed with code changes
   * Begin each implementation comment with "Based on logs: ..." 
   * Reference specific log values in your reasoning

4. NO-ASSUMPTIONS TESTING:
   * First iteration: ONLY console.log statements - NO ASSERTIONS WHATSOEVER
   * Second iteration: Run tests and SHOW ME THE ACTUAL CONSOLE OUTPUT
   * Third iteration: ONLY THEN propose assertions based on verified output

SEQUENCE ENFORCEMENT:
CONSOLE.LOG → NPM RUN TEST → READ LOGS → UPDATE CODE → NPM RUN TEST → READ LOGS → MAKE ASSERTIONS

ANY SOLUTION THAT SKIPS THE LOGGING STEP IS WRONG BY DEFINITION.