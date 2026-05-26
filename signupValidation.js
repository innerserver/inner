function validateSignup(body) {
  const required = [
    "email",
    "phone",
    "displayName"
  ];

  for (const field of required) {
    if (!body[field]) {
      return {
        success: false,
        error: `Missing ${field}`
      };
    }
  }

  return { success: true };
}

module.exports = { validateSignup };
