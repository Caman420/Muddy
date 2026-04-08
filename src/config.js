const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 4000),
  motd: 'Welcome to Muddy - DBZ server scaffold',
};

module.exports = config;
