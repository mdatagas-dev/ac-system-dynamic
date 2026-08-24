const logger = (req, res, next) => {
  const time = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip;

  console.log(`[${time}] ${method} ${url} - ${ip}`);
  next();
};

module.exports = logger;
