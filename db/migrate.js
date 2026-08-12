import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for extracting clean name and marriage notes
function extractDetailsFromName(rawName) {
  let cleanName = rawName.trim();
  let notes = [];
  let marriagesCount = 1;
  let marriageNote = null;

  const matches = rawName.match(/\(([^)]+)\)/g);
  if (matches) {
    matches.forEach(m => {
      const note = m.replace(/[\(\)]/g, '').trim();
      if (note.includes('शादी')) {
        marriageNote = note;
        if (note.includes('तीन') || note.includes('3')) marriagesCount = 3;
        else if (note.includes('दो') || note.includes('2')) marriagesCount = 2;
        else if (note.includes('चार') || note.includes('4')) marriagesCount = 4;
      } else {
        notes.push(note);
      }
    });
  }

  let nameOnly = cleanName.replace(/\(.*\)/g, '').trim();
  if (nameOnly && !nameOnly.endsWith('तिवारी')) {
    nameOnly += ' तिवारी';
  }
  return { rawName, cleanName: nameOnly, notes, marriagesCount, marriageNote };
}

// Parse hierarchical JSON into flat relational database records
function parseTreeToRelationalRecords(rawTreeData) {
  let idCounter = 1;
  const members = [];

  function traverse(node, fatherId = null, gen = 1) {
    const rawName = node.text?.name || 'अज्ञात';
    const title = node.text?.title || '';
    const dob = node.text?.DOB || null;
    const pid = `P_${String(idCounter++).padStart(3, '0')}`;

    const { cleanName, notes, marriagesCount, marriageNote } = extractDetailsFromName(rawName);

    const member = {
      id: pid,
      full_name: cleanName,
      raw_name: rawName,
      father_id: fatherId,
      dob: dob,
      title: title || null,
      gender: 'Male',
      occupation: title || (notes.includes('शास्त्री') ? 'ज्योतिषाचार्य / शास्त्री' : 'कृषि एवं समाज सेवा'),
      profile_image: './default_avatar.png',
      marriage_note: marriageNote,
      marriages_count: marriagesCount,
      generation_level: gen,
      created_at: new Date().toISOString()
    };

    members.push(member);

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => traverse(child, pid, gen + 1));
    }
  }

  rawTreeData.forEach(root => traverse(root, null, 1));
  return members;
}

// Perform Migration
async function runMigration() {
  console.log('🚀 Starting Family-GenApp Database Migration...');

  const treeJsonPath = path.join(__dirname, '../dist/treeData.json');
  if (!fs.existsSync(treeJsonPath)) {
    console.error('❌ treeData.json not found at:', treeJsonPath);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(treeJsonPath, 'utf8'));
  const relationalMembers = parseTreeToRelationalRecords(rawData);

  console.log(`✅ Extracted ${relationalMembers.length} member records from treeData.json`);

  // Default Initial Users
  const initialUsers = [
    {
      id: 'U_SUPER_ADMIN',
      first_name: 'Rohit',
      surname: 'Tiwari',
      full_name: 'Rohit Tiwari (Super Admin)',
      dob: '15/08/1995',
      mobile_number: '8871174576',
      email: 'rohit.tiwari@familygen.com',
      role: 'SUPER_ADMIN',
      status: 'Active',
      mobile_verified: 1,
      created_at: '2026-01-01'
    },
    {
      id: 'U_002',
      first_name: 'आयुष',
      surname: 'बेटू',
      full_name: 'आयुष (बेटू)',
      dob: '17/12/2001',
      mobile_number: '9876543210',
      email: 'ayush@village.com',
      role: 'MEMBER',
      status: 'Active',
      mobile_verified: 1,
      created_at: '2026-02-14'
    }
  ];

  // Default Audit Logs
  const initialLogs = [
    {
      id: 'LOG_001',
      action_type: 'System Initialization & DB Migration',
      user_modified: '8871174576 (Rohit Tiwari)',
      old_role: 'N/A',
      new_role: 'SUPER_ADMIN',
      changed_by: 'System Core',
      date_time: '2026-01-01 00:00:00'
    }
  ];

  const dbStore = {
    members: relationalMembers,
    users: initialUsers,
    audit_logs: initialLogs,
    migrated_at: new Date().toISOString()
  };

  const dbStorePath = path.join(__dirname, 'database_store.json');
  fs.writeFileSync(dbStorePath, JSON.stringify(dbStore, null, 2), 'utf8');

  // Also output insert statements SQL dump
  const sqlDumpPath = path.join(__dirname, 'data_dump.sql');
  let sqlContent = '-- Family-GenApp SQL Data Dump\n\n';

  relationalMembers.forEach(m => {
    sqlContent += `INSERT INTO members (id, full_name, raw_name, father_id, dob, title, gender, occupation, profile_image, marriage_note, marriages_count, generation_level) VALUES ('${m.id}', '${m.full_name.replace(/'/g, "''")}', '${m.raw_name.replace(/'/g, "''")}', ${m.father_id ? `'${m.father_id}'` : 'NULL'}, ${m.dob ? `'${m.dob}'` : 'NULL'}, ${m.title ? `'${m.title}'` : 'NULL'}, '${m.gender}', '${m.occupation}', '${m.profile_image}', ${m.marriage_note ? `'${m.marriage_note}'` : 'NULL'}, ${m.marriages_count}, ${m.generation_level});\n`;
  });

  initialUsers.forEach(u => {
    sqlContent += `INSERT INTO users (id, first_name, surname, full_name, dob, mobile_number, email, role, status, mobile_verified) VALUES ('${u.id}', '${u.first_name}', '${u.surname}', '${u.full_name}', '${u.dob}', '${u.mobile_number}', '${u.email}', '${u.role}', '${u.status}', TRUE);\n`;
  });

  fs.writeFileSync(sqlDumpPath, sqlContent, 'utf8');

  console.log(`🎉 Migration Completed Successfully!`);
  console.log(`📁 Database Store Created: ${dbStorePath}`);
  console.log(`📄 SQL Dump Created: ${sqlDumpPath}`);
}

runMigration().catch(console.error);
