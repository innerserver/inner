function announcementAudience(notice, user, rooms, canAccessRoom) {
  if (!notice || !user || notice.active === false) return false;
  if (notice.scope === "people") return Array.isArray(notice.recipientUsernames) && notice.recipientUsernames.includes(user.username);
  if (notice.scope === "room") {
    const room = (rooms || []).find((entry) => entry.id === notice.roomId);
    return Boolean(room && canAccessRoom(room, user));
  }
  return !notice.scope || notice.scope === "all";
}
module.exports = { announcementAudience };
