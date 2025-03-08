function formatConsoleDate(date) {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();

  return `[${hour}:${minutes}:${seconds}.${milliseconds}]`;
}

function consoleLogWithStyle(message, colorCode = 37) {
  console.log(`\x1b[${colorCode}m%s\x1b[0m`, `${message}`);
}

module.exports = {
  consoleLogWithStyle,
};
