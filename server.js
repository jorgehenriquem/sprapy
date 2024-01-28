

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // Desabilita o sandbox
    headless: false ,
    userDataDir: '/home/jorge/puppeteer_data' //@todo colocar em .env
});
  const page = await browser.newPage();
  await page.goto('http://example.com');
  await page.screenshot({path: 'example.png'});
  await browser.close();
})();