import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const srcResDir = path.join(rootDir, 'resources', 'android', 'res');
const targetResDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);

    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

console.log('📦 Applying Android Adaptive Launcher Icons from Orjon Logo...');

if (!fs.existsSync(srcResDir)) {
  console.error(`❌ Source resources directory ${srcResDir} does not exist.`);
  process.exit(1);
}

if (!fs.existsSync(targetResDir)) {
  console.log(`ℹ️ Android res directory ${targetResDir} does not exist yet (Android project not generated).`);
  console.log(`Pre-generated adaptive icons in resources/android/res are ready.`);
  process.exit(0);
}

copyFolderRecursiveSync(srcResDir, targetResDir);
console.log('✅ Android adaptive launcher icons (mipmap-anydpi-v26, ic_launcher, ic_launcher_round, ic_launcher_foreground) successfully applied to:', targetResDir);
