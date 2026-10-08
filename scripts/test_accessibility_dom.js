/**
 * scripts/test_accessibility_dom.js (v3.28.1)
 * Static regression prevention test scanner to enforce that all form controls (input, select, textarea)
 * in view templates have explicit 'id', 'name', and are properly labeled (via aria-label, aria-labelledby, or <label for="...">).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { strict as assert } from 'assert';

console.log('=== RUNNING STATIC DOM ACCESSIBILITY REGRESSION TEST ===');

function walkDir(dir) {
  let results = [];
  const list = readdirSync(dir);
  list.forEach(file => {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.html')) {
      results.push(fullPath);
    }
  });
  return results;
}

const filesToScan = [
  'src/components/recipe/RecipeWizardViews.js',
  'src/components/recipe/RecipeWizardTaxonomySearch.js',
  'src/components/pantry/CategoryManagerModalUI.js',
  'src/components/recipe/RecipeWizardTaxonomyModal.js',
  'src/components/recipe-editor/RecipeIngredientRow.js',
  'PlatePlan.html'
];

let totalErrors = 0;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

filesToScan.forEach(file => {
  const filePath = file.startsWith(process.cwd()) ? file : join(process.cwd(), file);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`❌ Failed to read file ${file}:`, err.message);
    totalErrors++;
    return;
  }

  console.log(`Scanning: ${file}...`);
  const errors = [];

  // Extract all "label for" IDs from the file
  const labelForRegex = /<label\s+[^>]*\bfor\s*=\s*(['"])(.*?)\1/gi;
  const labelFors = new Set();
  let labelMatch;
  while ((labelMatch = labelForRegex.exec(content)) !== null) {
    labelFors.add(labelMatch[2]);
  }

  // Also match simple non-quoted labels or interpolated labels like for="${selId}" or for="wiz-rev-prepm"
  const labelForInterpolatedRegex = /for="([^"]+)"|for='([^']+)'/gi;
  while ((labelMatch = labelForInterpolatedRegex.exec(content)) !== null) {
    const val = labelMatch[1] || labelMatch[2];
    labelFors.add(val);
  }

  // Match all form control tags: <input ...>, <select ...>, <textarea ...>
  // We match till first closing tag or next bracket
  const inputRegex = /<(input|select|textarea)\b([^>]*)\/?>/gi;
  let match;

  while ((match = inputRegex.exec(content)) !== null) {
    const tag = match[1];
    const attrs = match[2];

    // Skip hidden checkbox tags unless they can be labeled or are type=hidden
    if (attrs.includes('type="hidden"') || attrs.includes("type='hidden'")) {
      continue;
    }

    // Extract ID attribute
    const idMatch = /\bid\s*=\s*(['"])(.*?)\1/i.exec(attrs) || /\bid\s*=\s*([^\s>]+)/i.exec(attrs);
    const id = idMatch ? idMatch[2].replace(/['"]/g, '').trim() : null;

    // Extract Name attribute
    const nameMatch = /\bname\s*=\s*(['"])(.*?)\1/i.exec(attrs) || /\bname\s*=\s*([^\s>]+)/i.exec(attrs);
    const name = nameMatch ? nameMatch[2].replace(/['"]/g, '').trim() : null;

    // Extract aria-label or aria-labelledby attributes
    const ariaLabelMatch = /\baria-label\s*=\s*(['"])(.*?)\1/i.exec(attrs) || /\baria-label\s*=\s*([^\s>]+)/i.exec(attrs);
    const ariaLabel = ariaLabelMatch ? ariaLabelMatch[2].replace(/['"]/g, '').trim() : null;

    const ariaLabelledbyMatch = /\baria-labelledby\s*=\s*(['"])(.*?)\1/i.exec(attrs) || /\baria-labelledby\s*=\s*([^\s>]+)/i.exec(attrs);
    const ariaLabelledby = ariaLabelledbyMatch ? ariaLabelledbyMatch[2].replace(/['"]/g, '').trim() : null;

    const hasAriaLabel = !!(ariaLabel || ariaLabelledby);

    let fileLine = content.slice(0, match.index).split('\n').length;

    // Validate ID
    if (!id) {
      errors.push(`Line ${fileLine}: Missing 'id' attribute in <${tag}>: ${match[0].slice(0, 120)}`);
    }

    // Validate Name
    if (!name) {
      errors.push(`Line ${fileLine}: Missing 'name' attribute in <${tag}>: ${match[0].slice(0, 120)}`);
    }

    // Validate Labeling/Pairing
    if (id) {
      const isPairedWithLabel = labelFors.has(id);
      if (!isPairedWithLabel && !hasAriaLabel) {
        errors.push(`Line ${fileLine}: <${tag} id="${id}"> is not paired with a <label for="${id}"> or explicit 'aria-label'/'aria-labelledby'`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`❌ Accessibility failures in ${file}:`);
    errors.forEach(err => console.error(`  - ${err}`));
    totalErrors += errors.length;
  } else {
    console.log(`✅ ${file} passed accessibility check.`);
  }
});

if (totalErrors > 0) {
  console.error(`\n❌ Accessibility DOM sweep failed with ${totalErrors} issue(s). Preventing build/lint completion.`);
  process.exit(1);
} else {
  console.log('\n✅ ALL DOM ACCESSIBILITY CHECKS PASSED SUCCESSFULLY!');
  process.exit(0);
}
