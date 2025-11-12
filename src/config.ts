export const config = {
  sessionSecret: process.env.SESSION_SECRET || 'rahasia',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'sid',
};
