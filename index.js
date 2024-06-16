require("dotenv").config();
const puppeteer = require("puppeteer");
const tinderService = require("./services/tinderService");
const bumbleService = require("./services/bumbleService");

(async () => {
  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--start-maximized",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
    headless: false,
    userDataDir: "/home/jorge/puppeteer_data",
  });

  const tinderPage = await setupPage(browser, "https://tinder.com/app/recs");
  // const bumblePage = await setupPage(browser, "https://bumble.com/app");

  await Promise.all([
    tinderService.runTinderInteraction(tinderPage),
    // bumbleService.runBumbleInteraction(bumblePage),
  ]);
})();

async function setupPage(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
  );
  await page.goto(url, { waitUntil: "load" });
  return page;
}
