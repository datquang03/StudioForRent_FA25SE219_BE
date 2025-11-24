import dotenv from 'dotenv';
dotenv.config();

console.log('\n🔍 Getty Images Configuration Check\n' + '='.repeat(50));

const checks = [
  { name: 'API Key', value: process.env.GETTY_API_KEY },
  { name: 'Client ID', value: process.env.GETTY_CLIENT_ID },
  { name: 'Client Secret', value: process.env.GETTY_CLIENT_SECRET },
  { name: 'Cloudinary Cloud Name', value: process.env.CLOUDINARY_CLOUD_NAME },
  { name: 'Cloudinary API Key', value: process.env.CLOUDINARY_API_KEY },
  { name: 'Cloudinary API Secret', value: process.env.CLOUDINARY_API_SECRET },
];

let allGood = true;

checks.forEach(({ name, value }) => {
  const status = value ? '✅ Set' : '❌ Missing';
  console.log(`${name.padEnd(25)} ${status}`);
  if (!value) allGood = false;
});

console.log('='.repeat(50));

if (allGood) {
  console.log('✅ All configuration variables are set!\n');
  
  // Check if API_KEY and CLIENT_ID match
  if (process.env.GETTY_API_KEY === process.env.GETTY_CLIENT_ID) {
    console.log('✅ GETTY_API_KEY and GETTY_CLIENT_ID match (correct)');
  } else {
    console.log('⚠️  WARNING: GETTY_API_KEY and GETTY_CLIENT_ID should be the same!');
    console.log(`   GETTY_API_KEY: ${process.env.GETTY_API_KEY?.substring(0, 10)}...`);
    console.log(`   GETTY_CLIENT_ID: ${process.env.GETTY_CLIENT_ID?.substring(0, 10)}...`);
    allGood = false;
  }
  
  console.log('');
} else {
  console.log('❌ Some configuration variables are missing!');
  console.log('');
  console.log('📝 To fix this:');
  console.log('1. Create or update your .env file');
  console.log('2. Add the missing variables (see GETTY_API_QUICK_START.md)');
  console.log('3. Run this script again');
  console.log('');
}

process.exit(allGood ? 0 : 1);
