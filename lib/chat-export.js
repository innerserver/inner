// Export the caller's conversations only. Do not use administrator-wide DM
// visibility here: exporting one's account is different from a staff data view.
function buildChatExport({ user, rooms, messages, dms, groups }, policy) {
  const visibleRooms = rooms.filter((room) => policy.canAccessRoom(room, user));
  const roomIds = new Set(visibleRooms.map((room) => room.id));
  const dmGroups = groups.filter((group) => Array.isArray(group.participants) && group.participants.includes(user.username)).map(policy.sanitizeDmGroup);
  const groupIds = new Set(dmGroups.map((group) => group.id));
  return {
    rooms: visibleRooms.map((room) => ({ id: room.id, name: room.name })),
    messages: messages.filter((message) => roomIds.has(message.roomId || "main")).map((message) => policy.safeRoomMessage(message, user)),
    dmGroups,
    dms: dms.filter((dm) => Array.isArray(dm.participants) && dm.participants.includes(user.username) && ((dm.kind === "group" || dm.groupId) ? groupIds.has(dm.groupId) : true)).map((dm) => policy.safeDm(dm, user)),
    note: "Includes your currently accessible rooms, current group memberships and participating personal DMs, across grades. Attachment links are references, not file bytes. Deleted or expired history is unavailable.",
  };
}
module.exports = { buildChatExport };
