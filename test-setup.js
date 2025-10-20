// Test script to verify Job Lander Extension setup
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Job Lander Extension Setup...\n');

// Test 1: Check required files exist
const requiredFiles = [
  'manifest.json',
  'background.js',
  'popup/index.html',
  'src/popup.jsx',
  'src/styles.css',
  'src/components/App.jsx',
  'src/components/LoginForm.jsx',
  'src/components/Dashboard.jsx',
  'content-scripts/linkedinScraper.js',
  'content-scripts/indeedScraper.js',
  'content-scripts/glassdoorScraper.js',
  'content-scripts/genericScraper.js',
  'utils/auth.js',
  'utils/api.js',
  'webpack.config.js',
  'package.json'
];

let missingFiles = [];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    missingFiles.push(file);
  }
});

// Test 2: Check package.json dependencies
console.log('\n📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const requiredDeps = ['react', 'react-dom', 'lucide-react', 'date-fns'];
  const requiredDevDeps = ['webpack', 'babel-loader', 'tailwindcss'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`  ✅ ${dep}`);
    } else {
      console.log(`  ❌ ${dep} - Missing dependency`);
    }
  });
  
  requiredDevDeps.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      console.log(`  ✅ ${dep} (dev)`);
    } else {
      console.log(`  ❌ ${dep} - Missing dev dependency`);
    }
  });
} catch (error) {
  console.log('  ❌ Error reading package.json');
}

// Test 3: Check manifest.json
console.log('\n📋 Checking manifest.json...');
try {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  
  if (manifest.manifest_version === 3) {
    console.log('  ✅ Manifest version 3');
  } else {
    console.log('  ❌ Wrong manifest version');
  }
  
  if (manifest.permissions && manifest.permissions.includes('storage')) {
    console.log('  ✅ Storage permission');
  } else {
    console.log('  ❌ Missing storage permission');
  }
  
  if (manifest.content_scripts && manifest.content_scripts.length > 0) {
    console.log('  ✅ Content scripts configured');
  } else {
    console.log('  ❌ No content scripts found');
  }
} catch (error) {
  console.log('  ❌ Error reading manifest.json');
}

// Test 4: Check for icons
console.log('\n🎨 Checking icons...');
const iconSizes = ['16', '32', '48', '128'];
iconSizes.forEach(size => {
  const iconPath = `assets/icon-${size}.png`;
  if (fs.existsSync(iconPath)) {
    console.log(`  ✅ icon-${size}.png`);
  } else {
    console.log(`  ⚠️  icon-${size}.png - Missing (create placeholder)`);
  }
});

// Test 5: Check node_modules
console.log('\n📚 Checking dependencies...');
if (fs.existsSync('node_modules')) {
  console.log('  ✅ node_modules folder exists');
  
  // Check if key dependencies are installed
  const keyDeps = ['react', 'webpack', 'tailwindcss'];
  keyDeps.forEach(dep => {
    if (fs.existsSync(`node_modules/${dep}`)) {
      console.log(`  ✅ ${dep} installed`);
    } else {
      console.log(`  ❌ ${dep} not installed`);
    }
  });
} else {
  console.log('  ❌ node_modules not found - Run npm install');
}

// Test 6: Check build output
console.log('\n🏗️  Checking build...');
if (fs.existsSync('dist')) {
  console.log('  ✅ dist folder exists');
  
  const buildFiles = ['popup.js', 'background.js'];
  buildFiles.forEach(file => {
    if (fs.existsSync(`dist/${file}`)) {
      console.log(`  ✅ dist/${file}`);
    } else {
      console.log(`  ❌ dist/${file} - Run npm run build`);
    }
  });
} else {
  console.log('  ❌ dist folder not found - Run npm run build');
}

// Summary
console.log('\n📊 Setup Summary:');
if (missingFiles.length === 0) {
  console.log('✅ All required files present');
} else {
  console.log(`❌ Missing ${missingFiles.length} files:`, missingFiles);
}

console.log('\n🚀 Next Steps:');
console.log('1. Run: npm install');
console.log('2. Add icons to assets/ folder (or create placeholders)');
console.log('3. Run: npm run build');
console.log('4. Load extension in Chrome (chrome://extensions/)');
console.log('5. Test authentication and job capture');

console.log('\n💡 For detailed setup instructions, see HOW_TO_RUN.md');
