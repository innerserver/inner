const { gradeSelectionMatches } = require("../public/grade-utils");

// Provision shared year rooms without widening or deleting old section-room history.
module.exports.synchronizeGradeRooms = function synchronizeGradeRooms(rooms, users, { classRoomGrade, canModerate, sanitizeRoom }) {
  let changed = false;
  for (let year = 6; year <= 12; year++) {
    const grade = String(year);
    let room = rooms.find((entry) => classRoomGrade(entry) === grade);
    if (!room) {
      let id = `grade-${grade}`;
      if (rooms.some((entry) => entry.id === id)) id = require("crypto").randomUUID();
      room = sanitizeRoom({ id, name: `Grade ${grade}`, classGrade: grade, category: "Grades", private: true, allowedUsers: [], createdBy: "system", createdAt: new Date().toISOString() });
      rooms.push(room); changed = true;
    }
    const next = { name: `Grade ${grade}`, classGrade: grade, category: "Grades", private: true, inviteOnly: false, passwordHash: "", requiresPassword: false };
    for (const [key, value] of Object.entries(next)) {
      if (JSON.stringify(room[key]) !== JSON.stringify(value)) { room[key] = value; changed = true; }
    }
  }
  // Keep legacy section rooms private to their current class as well. All entry
  // points use this same roster policy, without widening old A/B/C history.
  for (const room of rooms) {
    const grade = classRoomGrade(room);
    if (!grade) continue;
    const members = users.filter((user) => !canModerate(user) && gradeSelectionMatches(grade, user.grade)).map((user) => user.username).sort();
    if (JSON.stringify(room.allowedUsers || []) !== JSON.stringify(members)) {
      room.allowedUsers = members;
      changed = true;
    }
  }
  return { rooms, changed };
};
