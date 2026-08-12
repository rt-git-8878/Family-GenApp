import rawTreeData from '../data/rawTreeData.json';

let idCounter = 1;
const DEFAULT_AVATAR = './default_avatar.png';

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
        else if (note.includes('एक') || note.includes('1')) marriagesCount = 1;
      } else {
        notes.push(note);
      }
    });
  }

  const nameOnly = cleanName.replace(/\(.*\)/g, '').trim();

  return {
    rawName,
    cleanName: nameOnly,
    notes,
    marriagesCount,
    marriageNote
  };
}

function processTree() {
  const members = [];
  const memberMap = new Map();

  function traverse(node, fatherId = null, generation = 1) {
    const rawName = node.text?.name || 'अज्ञात';
    const title = node.text?.title || '';
    const dob = node.text?.DOB || null;
    
    const personId = `P_${String(idCounter++).padStart(3, '0')}`;
    const { cleanName, notes, marriagesCount, marriageNote } = extractDetailsFromName(rawName);

    const gender = 'Male';
    const occupation = title || (notes.includes('शास्त्री') ? 'ज्योतिषाचार्य / शास्त्री' : 'कृषि एवं समाज सेवा');

    const person = {
      Person_ID: personId,
      Full_Name: cleanName,
      Raw_Name: rawName,
      Father_ID: fatherId,
      Mother_ID: null,
      Spouse_ID: null,
      DOB: dob,
      Gender: gender,
      Occupation: occupation,
      Profile_Image: DEFAULT_AVATAR,
      Title: title,
      Notes: notes,
      Marriages_Count: marriagesCount,
      Marriage_Note: marriageNote,
      Generation_Level: generation,
      Children_IDs: []
    };

    members.push(person);
    memberMap.set(personId, person);

    if (fatherId && memberMap.has(fatherId)) {
      memberMap.get(fatherId).Children_IDs.push(personId);
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        traverse(child, personId, generation + 1);
      });
    }

    return personId;
  }

  rawTreeData.forEach(root => {
    traverse(root, null, 1);
  });

  return { members, memberMap };
}

const { members: ALL_MEMBERS, memberMap: MEMBER_MAP } = processTree();

export const dataAdapter = {
  getAllMembers: () => ALL_MEMBERS,
  getMemberById: (id) => MEMBER_MAP.get(id) || null,
  getParents: (id) => {
    const member = MEMBER_MAP.get(id);
    if (!member) return { father: null, mother: null };
    const father = member.Father_ID ? MEMBER_MAP.get(member.Father_ID) : null;
    const mother = member.Mother_ID ? MEMBER_MAP.get(member.Mother_ID) : null;
    return { father, mother };
  },
  getSpouse: (id) => {
    const member = MEMBER_MAP.get(id);
    if (!member || !member.Spouse_ID) return null;
    return MEMBER_MAP.get(member.Spouse_ID) || null;
  },
  getChildren: (id) => {
    const member = MEMBER_MAP.get(id);
    if (!member) return [];
    return member.Children_IDs.map(childId => MEMBER_MAP.get(childId)).filter(Boolean);
  },
  getSiblings: (id) => {
    const member = MEMBER_MAP.get(id);
    if (!member || !member.Father_ID) return [];
    const father = MEMBER_MAP.get(member.Father_ID);
    if (!father) return [];
    return father.Children_IDs
      .filter(childId => childId !== id)
      .map(childId => MEMBER_MAP.get(childId))
      .filter(Boolean);
  },
  get3GenLineage: (focusId) => {
    const focus = MEMBER_MAP.get(focusId) || ALL_MEMBERS[0];
    const father = focus.Father_ID ? MEMBER_MAP.get(focus.Father_ID) : null;
    const mother = focus.Mother_ID ? MEMBER_MAP.get(focus.Mother_ID) : null;
    const grandFather = father?.Father_ID ? MEMBER_MAP.get(father.Father_ID) : null;
    const grandMother = father?.Mother_ID ? MEMBER_MAP.get(father.Mother_ID) : null;
    const children = (focus.Children_IDs || []).map(cid => MEMBER_MAP.get(cid)).filter(Boolean);
    const siblings = father ? father.Children_IDs.filter(cid => cid !== focus.Person_ID).map(cid => MEMBER_MAP.get(cid)) : [];

    return { focus, father, mother, grandFather, grandMother, children, siblings };
  },
  searchMembers: (query) => {
    if (!query || query.trim() === '') return ALL_MEMBERS;
    const q = query.toLowerCase().trim();
    return ALL_MEMBERS.filter(m => 
      m.Full_Name.toLowerCase().includes(q) ||
      m.Raw_Name.toLowerCase().includes(q) ||
      (m.Marriage_Note && m.Marriage_Note.toLowerCase().includes(q)) ||
      (m.DOB && m.DOB.toLowerCase().includes(q)) ||
      (m.Occupation && m.Occupation.toLowerCase().includes(q)) ||
      m.Person_ID.toLowerCase().includes(q) ||
      m.Notes.some(note => note.toLowerCase().includes(q))
    );
  },
  getStats: () => {
    const maxGen = Math.max(...ALL_MEMBERS.map(m => m.Generation_Level));
    return {
      totalMembers: ALL_MEMBERS.length,
      totalGenerations: maxGen,
      rootPatriarch: ALL_MEMBERS[0]
    };
  }
};
