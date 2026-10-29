const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function fixPasswords() {
    try {
        const hash = await bcrypt.hash('Admin@123', 10);
        console.log('Generated valid hash:', hash);
        
        await db.query('UPDATE users SET password = ?', [hash]);
        console.log('Successfully updated passwords in database!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixPasswords();
