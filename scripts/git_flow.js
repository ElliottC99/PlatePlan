#!/usr/bin/env node
/**
 * scripts/git_flow.js
 * Standardized git lifecycle automation for PlatePlan.
 *
 * Usage:
 *   node scripts/git_flow.js start <short-name>   # Branch from latest development
 *   node scripts/git_flow.js sync                 # Pull & merge origin/development into current dev branch
 *   node scripts/git_flow.js clean                # Safely delete local branches merged into development
 *   node scripts/git_flow.js status               # Check branch distance and sync status
 */

import { execSync } from 'node:child_process';

const action = process.argv[2];
const param = process.argv[3];

function run(cmd, { silent = false } = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
  } catch (err) {
    if (!silent) {
      console.error(`\x1b[31m[git-flow] Command failed:\x1b[0m ${cmd}`);
    }
    throw err;
  }
}

function runOut(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function getCurrentBranch() {
  return runOut('git branch --show-current');
}

function isWorkingTreeClean() {
  const status = runOut('git status --porcelain');
  return status.length === 0;
}

switch (action) {
  case 'start': {
    if (!param) {
      console.error('\x1b[31m[git-flow] Error:\x1b[0m Please provide a branch name, e.g. `npm run branch:start fit-score-fix`');
      process.exit(1);
    }
    if (!isWorkingTreeClean()) {
      console.error('\x1b[31m[git-flow] Error:\x1b[0m Working tree has uncommitted changes. Commit or stash them first.');
      process.exit(1);
    }

    const branchName = param.startsWith('dev/') ? param : `dev/${param}`;
    console.log(`\x1b[36m[git-flow]\x1b[0m Switching to development and pulling latest origin/development...`);
    run('git switch development');
    run('git pull origin development');

    console.log(`\x1b[36m[git-flow]\x1b[0m Creating fresh feature branch: \x1b[32m${branchName}\x1b[0m`);
    run(`git switch -c ${branchName}`);
    console.log(`\x1b[32m✔ Successfully started branch ${branchName} from latest development!\x1b[0m`);
    break;
  }

  case 'sync': {
    const current = getCurrentBranch();
    if (!current.startsWith('dev/')) {
      console.error(`\x1b[31m[git-flow] Warning:\x1b[0m Current branch is '${current}'. Sync is designed for dev/* feature branches.`);
    }
    console.log(`\x1b[36m[git-flow]\x1b[0m Fetching latest origin and merging origin/development into \x1b[32m${current}\x1b[0m...`);
    run('git fetch origin');
    run('git merge origin/development --no-edit');
    console.log(`\x1b[32m✔ Branch ${current} is up to date with origin/development.\x1b[0m`);
    break;
  }

  case 'clean':
  case 'prune': {
    console.log(`\x1b[36m[git-flow]\x1b[0m Checking for local branches already merged into development...`);
    try { run('git fetch origin --prune', { silent: true }); } catch { /* offline / sandbox fallback */ }
    const current = getCurrentBranch();
    const mergedRaw = runOut('git branch --merged origin/development');
    const branches = mergedRaw
      .split('\n')
      .map(b => b.trim().replace(/^\*\s*/, ''))
      .filter(b => b && b !== 'development' && b !== 'main' && b !== 'studio' && b !== current && b.startsWith('dev/'));

    if (branches.length === 0) {
      console.log(`\x1b[32m✔ No stale merged feature branches to clean.\x1b[0m`);
      break;
    }

    console.log(`\x1b[36m[git-flow]\x1b[0m Safely deleting ${branches.length} merged branch(es):`);
    branches.forEach(b => {
      run(`git branch -d ${b}`);
      console.log(`  \x1b[32m✔ Deleted ${b}\x1b[0m`);
    });
    break;
  }

  case 'status': {
    const current = getCurrentBranch();
    console.log(`\x1b[36mCurrent Branch:\x1b[0m ${current}`);
    try { run('git fetch origin', { silent: true }); } catch { /* offline / sandbox fallback */ }
    const ahead = runOut(`git rev-list --count origin/development..${current}`);
    const behind = runOut(`git rev-list --count ${current}..origin/development`);
    console.log(`\x1b[36mDistance from origin/development:\x1b[0m +${ahead} commit(s), -${behind} commit(s)`);
    break;
  }

  default:
    console.log(`
\x1b[1mPlatePlan Git Flow Helper\x1b[0m
Commands:
  npm run branch:start <topic>   Switch to development, pull latest, and branch dev/<topic>
  npm run branch:sync            Fetch origin and merge origin/development into current branch
  npm run branch:clean           Delete local feature branches merged into development
  npm run branch:status          Check distance from origin/development
`);
}
