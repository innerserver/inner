function parentEmails(value, required = true) {
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length > 3) fail('Provide one to three parent email addresses');
  const emails = value.map(value => String(value).trim().toLowerCase()).filter(Boolean);
  if (required && !emails.length) fail('At least one parent email is required for students');
  if (emails.some(email => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail('Enter valid parent email addresses');
  if (new Set(emails).size !== emails.length) fail('Parent email addresses must be different');
  return emails;
}
function publicStudent(body) {
  if ([body.role, body.requestedRole].some(role => role !== undefined && !['member','student'].includes(String(role).toLowerCase()))) throw Object.assign(new Error('Public registration is for students only. Staff accounts must be created by an admin.'), {statusCode:403});
}
module.exports = { parentEmails, publicStudent };
