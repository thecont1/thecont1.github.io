#!/usr/bin/env node

import { generateFromCLI } from '../src/utils/generateCodeContent.ts';

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: node scripts/generate-repo-content.js <repo-identifier> [github-token]

Examples:
  node scripts/generate-repo-content.js thecont1/my-awesome-project
  node scripts/generate-repo-content.js https://github.com/thecont1/my-awesome-project
  node scripts/generate-repo-content.js thecont1/my-awesome-project ghp_xxxxxxxxxxxx

Environment Variables:
  GITHUB_TOKEN - GitHub personal access token for higher rate limits
  `);
  process.exit(1);
}

const repoIdentifier = args[0];
const githubToken = args[1] || process.env.GITHUB_TOKEN;

if (!githubToken) {
  console.warn('⚠️  No GitHub token provided. API rate limits may apply.');
  console.warn('   Set GITHUB_TOKEN environment variable or pass as second argument.');
}

// Generate the content
generateFromCLI(repoIdentifier, githubToken);