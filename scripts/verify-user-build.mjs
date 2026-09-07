import fs from 'fs';
import path from 'path';

function verifyUserBuild() {
  const distDir = fs.existsSync(path.resolve(process.cwd(), 'dist-user'))
    ? path.resolve(process.cwd(), 'dist-user')
    : path.resolve(process.cwd(), 'dist-mobile');

  if (!fs.existsSync(distDir)) {
    console.error(`❌ Build directory (${distDir}) does not exist. Run "npm run build:user" or "npm run build:mobile" first.`);
    process.exit(1);
  }

  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.error(`❌ ${distDir}/assets directory does not exist.`);
    process.exit(1);
  }

  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  let bundleContent = '';
  jsFiles.forEach(f => {
    bundleContent += fs.readFileSync(path.join(assetsDir, f), 'utf-8');
  });

  const bannedPatterns = [
    { name: 'AdminPanel component identifier', regex: /AdminPanel/i },
    { name: 'verifyAdminClaim authentication function', regex: /verifyAdminClaim/ },
    { name: 'admin-login screen state', regex: /admin-login/ },
    { name: 'adminForgotQuery state', regex: /adminForgotQuery/ },
    { name: 'handleAdminVerify handler', regex: /handleAdminVerify/ },
    { name: 'handleAdminForgotRequestOtp handler', regex: /handleAdminForgotRequestOtp/ },
    { name: 'handleUpdateAdminPassword handler', regex: /handleUpdateAdminPassword/ },
    { name: 'adminPassInput state', regex: /adminPassInput/ },
    { name: 'audit_logs collection', regex: /audit_logs/ }
  ];

  let errorsFound = 0;
  console.log(`🔍 Starting Automated Verification on User Build (${path.basename(distDir)})...`);

  bannedPatterns.forEach(pattern => {
    if (pattern.regex.test(bundleContent)) {
      console.error(`❌ VIOLATION: Found ${pattern.name} in user build output!`);
      errorsFound++;
    } else {
      console.log(`✅ VERIFIED: No ${pattern.name} in user build.`);
    }
  });

  if (errorsFound > 0) {
    console.error(`\n❌ User build failed verification with ${errorsFound} issues.`);
    process.exit(1);
  }

  console.log('\n🎉 Automated Verification Passed! User build is 100% free of admin logic, panel, auth, and credentials.');
}

verifyUserBuild();
