const {
  sleep,
  findWordsInPage,
  clickActionKey,
  reloadMessageConsole,
} = require("../utils/helpers");
const { consoleLogWithStyle } = require("../utils/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

async function runTinderInteraction(page) {
  while (true) {
    await sleep(1000);
    let selectorVisible = await isSelectorVisible(
      page,
      "span.Typs\\(display-1-strong\\)"
    );
    try {
      await sleep(1000);
      await openProfile(page);
      const blackList = await findWordsInPage(
        page,
        process.env.BLACKLIST_WORDS.split(",")
      );
      const bioOnlyInsta = await singleInstaBioVerification(page);
      if (blackList || bioOnlyInsta) {
        await decideLikeOrNope(page, "Não", true);
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
      fs.writeFileSync("TinderPic.png", screenshotBuffer);
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
      const prompt = process.env.PROMPT;
      const image = {
        inlineData: {
          data: Buffer.from(fs.readFileSync("TinderPic.png")).toString(
            "base64"
          ),
          mimeType: "image/png",
        },
      };
      const result = await model.generateContent([prompt, image]);
      const response = await result.response;
      const text = response.text();
      console.log(text);
      try {
        await page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll('button[type="button"]')).some(
              (button) => button.textContent.includes("Denunciar")
            ),
          { timeout: 20000 }
        );
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
          const fileName = `Nopes/Tinder/TinderPic_${timestamp}.png`;

          fs.writeFileSync(fileName, screenshotBuffer);
          await decideLikeOrNope(page, "Não");
        } else {
          await randomScroll(page);
          await decideLikeOrNope(page, "Sim");
        }
      } catch (error) {
        consoleLogWithStyle(error.message, "31");
        await decideLikeOrNope(page, "Sim");
        consoleLogWithStyle("Sim Pelo erro", "31");
      }
    } catch (error) {
      consoleLogWithStyle(error.message, "31");
      await decideLikeOrNope(page, "Sim");
      consoleLogWithStyle("Sim Pelo erro 2", "31");
    }

    await rejectSuperLike(page);
  }
}

/**
 * Rejects the super like prompt if visible.
 * @param {object} page - Puppeteer page object.
 */
async function rejectSuperLike(page) {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button.c1p6lbu0"));
    const targetButton = buttons.find((button) => {
      const buttonText = button.innerText || button.textContent;
      return buttonText.includes("Não, obrigado(a)");
    });
    if (targetButton) {
      targetButton.click();
    }
  });
}

/**
 * Performs a random scroll on the specified page.
 * @param {object} page - Puppeteer page object.
 */
async function randomScroll(page) {
  await page.evaluate(async () => {
    const randomBetween = (min, max) =>
      Math.floor(Math.random() * (max - min + 1) + min);

    const elemento = document.querySelector(".profileCard__card");
    if (elemento) {
      const totalHeight = elemento.scrollHeight;
      let currentPosition = 0;

      for (let i = 0; i < 5; i++) {
        const distance = randomBetween(-500, 500);
        currentPosition += distance;
        currentPosition = Math.min(Math.max(currentPosition, 0), totalHeight);

        elemento.scrollTo(0, currentPosition);
        await new Promise((resolve) =>
          setTimeout(resolve, randomBetween(200, 500))
        );
      }
    }
  });
}

/**
 * Finds if any <div> element within a specific type of container contains a single word starting with "@".
 * @param {object} page - Puppeteer page object.
 * @returns {boolean} - True if exactly one <div> element contains a single word starting with "@"; otherwise, false.
 */
async function singleInstaBioVerification(page) {
  const result = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      "div[class*='Px(16px)'][class*='Py(12px)'][class*='Us(t)'] > div"
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

/**
 * Opens the profile if the button is visible.
 * @param {object} page - Puppeteer page object.
 */
async function openProfile(page) {
  await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll("button[type='button']")
    );
    const targetButton = buttons.find((button) => {
      const hiddenSpan = button.querySelector("span.Hidden");
      return hiddenSpan && hiddenSpan.textContent.includes("Abrir perfil");
    });
    if (targetButton) {
      targetButton.click();
    }
  });
}

/**
 * Decides whether to like or nope based on the blacklist words.
 * @param {object} page - Puppeteer page object.
 * @param {string[]} blackListWords - Array of blacklist words.
 */
async function decideLikeOrNope(page, decision, bioOnlyInsta = false) {
  if (decision === "Não" || bioOnlyInsta) {
    await clickActionKey(page, "Não");
  } else {
    await clickActionKey(page, "Sim");
  }

  await sleep(1000);
}

/**
 * Checks if a specific selector is visible on the page within a given timeout.
 *
 * @param {object} page - The Puppeteer page instance.
 * @param {string} selector - The CSS selector to check for visibility.
 * @returns {Promise<boolean>} - A promise that resolves to 'true' if the selector is visible, 'false' otherwise.
 */
async function isSelectorVisible(page, selector) {
  return page
    .waitForSelector(selector, { visible: true, timeout: 5000 })
    .then(() => true)
    .catch(() => false);
}

module.exports = {
  runTinderInteraction,
};
