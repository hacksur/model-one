const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

// Correctly resolve the path to package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = require(packageJsonPath);

// Function to generate a short hash
function generateHash() {
  return crypto.randomBytes(6).toString('hex');
}

// Extract the numbered version and append the hash
const currentVersionParts = packageJson.version.split('-')[0];
const hash = generateHash();
const newVersion = `${currentVersionParts}-${hash}`;

packageJson.version = newVersion;

// Write the updated package.json back to file
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log(`Version updated to ${newVersion}`);

// Get current branch name
exec('git rev-parse --abbrev-ref HEAD', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error getting current branch: ${error}`);
    return;
  }
  
  const currentBranch = stdout.trim();
  
  // Run git commands to add changes and commit to the current branch
  const gitCommands = `
  git add . && 
  git commit -m "Checkpoint: ${newVersion}" && 
  git push origin ${currentBranch}
  `;

  exec(gitCommands, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing git commands: ${error}`);
      return;
    }
    if (stderr && !stderr.includes('Everything up-to-date')) {
      console.error(`Error in git operations: ${stderr}`);
      return;
    }
    console.log(`Checkpoint created successfully: ${newVersion}`);
    console.log(`Changes committed to branch: ${currentBranch}`);
  });
});