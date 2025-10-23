const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    entry.isDirectory() ?
      copyDirSync(srcPath, destPath) :
      fs.copyFileSync(srcPath, destPath);
  }
}

console.log('Starting post-build copy...');

const staticSource = path.join('.next', 'static');
const staticDest = path.join('.next', 'standalone', '.next', 'static');
const publicSource = 'public';
const publicDest = path.join('.next', 'standalone', 'public');

try {
  if (fs.existsSync(staticSource)) {
    console.log(`Copying ${staticSource} to ${staticDest}`);
    copyDirSync(staticSource, staticDest);
  } else {
    console.log(`${staticSource} not found, skipping.`);
  }

  if (fs.existsSync(publicSource)) {
    console.log(`Copying ${publicSource} to ${publicDest}`);
    copyDirSync(publicSource, publicDest);
  } else {
    console.log(`${publicSource} not found, skipping.`);
  }

  console.log('Post-build copy finished successfully.');
} catch (error) {
  console.error('Error during post-build copy:', error);
  process.exit(1);
}
