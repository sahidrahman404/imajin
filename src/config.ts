export const config = {
  sessionSecret: process.env.SESSION_SECRET || 'rahasia',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'sid',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  nodeEnv: process.env.NODE_ENV || 'development',
};
