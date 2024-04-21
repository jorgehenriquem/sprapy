const {
  sleep,
  randomBetween,
  findWordsInPage,
  clickActionKey,
} = require("../utils/helpers");
const { consoleLogWithStyle } = require("../utils/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

async function runBumbleInteraction(page) {
  while (true) {
    await sleep(1000);
    const blackList = await findWordsInPage(
      page,
      process.env.BLACKLIST_WORDS.split(",")
    );
    const bioOnlyInsta = await singleInstaBioVerificationBumble(page);
    if (blackList || bioOnlyInsta) {
      await decideLikeOrNopeBumble(page, "Não", true);
    }
    const screenWidth = 1920;
    const screenHeight = 1080;
    const clip = {
      x: screenWidth / 4,
      y: 0,
      width: screenWidth / 2,
      height: screenHeight,
    };
    const screenshotBuffer = await page.screenshot({ clip });
    fs.writeFileSync("BumblePic.png", screenshotBuffer);
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
      const prompt = process.env.PROMPT;
      const image = {
        inlineData: {
          data: Buffer.from(fs.readFileSync("BumblePic.png")).toString(
            "base64"
          ),
          mimeType: "image/png",
        },
      };
      const result = await model.generateContent([prompt, image]);
      const response = await result.response;
      const text = response.text();
      console.log(text);
      if (text.includes("Sim") || text.includes("sim")) {
        const screenWidth = 1920;
        const screenHeight = 1080;
        const clip = {
          x: screenWidth / 4,
          y: 0,
          width: screenWidth / 2,
          height: screenHeight,
        };
        const screenshotBuffer = await page.screenshot({ clip });
        const currentDate = new Date();
        const timestamp = currentDate.toISOString().replace(/:/g, "-");
        const fileName = `Nopes/Bumble/BumblePic_${timestamp}.png`;

        fs.writeFileSync(fileName, screenshotBuffer);
        await decideLikeOrNopeBumble(page, "Não");
      } else {
        await randomArrow(page);
        await decideLikeOrNopeBumble(page, "Sim");
      }
    } catch {
      await decideLikeOrNopeBumble(page, "Sim");
    }
  }
}

/**
 * Perform random keyboard arrow presses on the page.
 *
 * This function simulates random keyboard arrow presses, such as ArrowUp and ArrowDown,
 * on the page to mimic user interaction.
 *
 * @param {object} page - Puppeteer page object.
 * @returns {Promise<void>} A Promise that resolves when the random arrow presses are completed.
 */
async function randomArrow(page) {
  const randomBetween = (min, max) =>
    Math.floor(Math.random() * (max - min + 1) + min);

  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(randomBetween(1000, 2000));

  const totalKeyPresses = randomBetween(1, 2);
  for (let i = 0; i < totalKeyPresses; i++) {
    const isArrowUp = i % 2 === 0;
    const key = isArrowUp ? "ArrowUp" : "ArrowDown";
    await page.keyboard.press(key);
    await page.waitForTimeout(randomBetween(1000, 2000));
  }
}

/**
 * Decides whether to like or nope based on the blacklist words.
 * @param {object} page - Puppeteer page object.
 * @param {string[]} blackListWords - Array of blacklist words.
 */
async function decideLikeOrNopeBumble(page, decision, bioOnlyInsta = false) {
  const randomDecision = Math.random() < 0.9 ? "Sim" : "Não";
  await sleep(1000);

  if (decision === "Não" || bioOnlyInsta) {
    await clickActionKey(page, "nao");
  } else {
    await clickActionKey(page, randomDecision);
  }

  await sleep(1000);
}

/**
 * Checks if a single word starting with "@" exists in a <p> element within Bumble profile bio.
 *
 * This function verifies if there is exactly one <p> element containing a single word starting with "@"
 * within the Bumble profile bio.
 *
 * @param {object} page - Puppeteer page object.
 * @returns {Promise<boolean>} A Promise that resolves to 'true' if exactly one <p> element contains
 * a single word starting with "@"; otherwise, 'false'.
 */
async function singleInstaBioVerificationBumble(page) {
  const result = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      "p.encounters-story-about__text"
    );

    let wordCount = 0;
    let wordStartingWithAt = false;

    for (const element of elements) {
      const words = element.textContent.trim().split(/\s+/);
      if (words.length === 1 && words[0].startsWith("@")) {
        wordCount++;
        wordStartingWithAt = true;
      }
    }

    return wordCount === 1 && wordStartingWithAt;
  });

  return result;
}

module.exports = {
  runBumbleInteraction,
};
