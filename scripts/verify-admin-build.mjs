import fs from 'fs';
import path from 'path';

function verifyAdminBuild() {
  const distAdminDir = path.resolve(process.cwd(), 'dist-admin');
  if (!fs.existsSync(distAdminDir)) {
    console.error('❌ dist-admin directory does not exist. Run "npm run build:admin" first.');
    process.exit(1);
  }

  const assetsDir = path.join(distAdminDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.error('❌ dist-admin/assets directory does not exist.');
    process.exit(1);
  }

  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  let bundleContent = '';
  jsFiles.forEach(f => {
    bundleContent += fs.readFileSync(path.join(assetsDir, f), 'utf-8');
  });

  const bannedPatterns = [
    { name: 'UserPortal component identifier', regex: /UserPortal/i },
    { name: 'CourseEnrollmentModal component identifier', regex: /CourseEnrollmentModal/i },
    { name: 'CurrentAffairsFeed component identifier', regex: /CurrentAffairsFeed/i }
  ];

  let errorsFound = 0;
  console.log('🔍 Starting Automated Verification on Admin Build (dist-admin)...');

  bannedPatterns.forEach(pattern => {
    if (pattern.regex.test(bundleContent)) {
      console.error(`❌ VIOLATION: Found ${pattern.name} in admin build output!`);
      errorsFound++;
    } else {
      console.log(`✅ VERIFIED: No ${pattern.name} in admin build.`);
    }
  });

  if (errorsFound > 0) {
    console.error(`\n❌ Admin build failed verification with ${errorsFound} issues.`);
    process.exit(1);
  }

  console.log('\n🎉 Automated Verification Passed! Admin build is 100% free of UserPortal, CourseEnrollmentModal, and User-only feeds.');
}

verifyAdminBuild();
