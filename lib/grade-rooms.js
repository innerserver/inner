const { gradeYear } = require("../public/grade-utils");

// Provision shared year rooms without widening or deleting old section-room history.
module.exports.synchronizeGradeRooms = function synchronizeGradeRooms(rooms, users, { classRoomGrade, canModerate, sanitizeRoom }) {
  let changed = false;
  for (let year = 6; year <= 12; year++) {
    const grade = String(year);
    let room = rooms.find((entry) => classRoomGrade(entry) === grade);
    const members = users.filter((entry) => !canModerate(entry) && gradeYear(entry.grade) === grade).map((entry) => entry.username).sort();
    if (!room) {
      let id = `grade-${grade}`;
      if (rooms.some((entry) => entry.id === id)) id = require("crypto").randomUUID();
      room = sanitizeRoom({ id, name: `Grade ${grade}`, classGrade: grade, category: "Grades", private: true, allowedUsers: members, createdBy: "system", createdAt: new Date().toISOString() });
      rooms.push(room); changed = true;
    }
    const next = { name: `Grade ${grade}`, classGrade: grade, category: "Grades", private: true, inviteOnly: false, passwordHash: "", requiresPassword: false, allowedUsers: members };
    for (const [key, value] of Object.entries(next)) {
      if (JSON.stringify(room[key]) !== JSON.stringify(value)) { room[key] = value; changed = true; }
    }
  }
  return { rooms, changed };
};
