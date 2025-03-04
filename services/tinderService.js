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
      await sleep(1000);
      const blackList = await findWordsInPage(
        page,
        process.env.BLACKLIST_WORDS.split(",")
      );
      if (blackList) {
        await saveProfileScreenshot(page, "Nopes/Blacklist");
        await clickActionKey(page, "Não");
        await openProfile(page);
      }
      const screenWidth = 1600;
      const screenHeight = 900;
      await page.setViewport({
        width: screenWidth,
        height: screenHeight,
        deviceScaleFactor: 4,
      });

      const clip = {
        x: screenWidth / 2.5,
        y: 2.5,
        width: screenWidth / 3,
        height: screenHeight / 1.5,
      };
      const screenshotBuffer = await page.screenshot({ clip });
      fs.writeFileSync("TinderPic.png", screenshotBuffer);
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = process.env.PROMPT2;
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
      // console.log("Resposta do gemini:" + text);
      try {
        await page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll('button[type="button"]')).some(
              (button) => button.textContent.includes("Denunciar")
            ),
          { timeout: 20000 }
        );
        await matchPoints(text, page);
      } catch (error) {
        consoleLogWithStyle(error.message, "31");
        await saveProfileScreenshot(page, "Yes/Error");
        await decideLikeOrNope(page, "Sim");
        consoleLogWithStyle("Sim Pelo erro", "31");
      }
    } catch (error) {
      consoleLogWithStyle(error.message, "31");
      await saveProfileScreenshot(page, "Yes/Error");
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

async function matchPoints(tinderJson, page) {
  tinderJson = tinderJson.replace("```json", "");
  tinderJson = tinderJson.replace("```", "");
  tinderJson = JSON.parse(tinderJson);

  const pointsData = JSON.parse(fs.readFileSync("points.json"));
  let totalPoints = 0;

  for (const key in tinderJson) {
    const value = tinderJson[key].toLowerCase();
    const pointItems = pointsData.filter(
      (item) =>
        item.category.toLowerCase() === key.toLowerCase() &&
        value.includes(item.name.toLowerCase())
    );
    for (const pointItem of pointItems) {
      totalPoints += pointItem.points;
      console.log(`${key}: ${pointItem.name}(${pointItem.points})`);
    }
  }

  console.log(`Total de pontos: ${totalPoints}`);

  if (totalPoints >= 15) {
    await saveProfileScreenshot(page, "Yes/Tinder/Sup");
    await randomScroll(page);
    consoleLogWithStyle("Mega Match!", "34");
    await decideLikeOrNope(page, "Sim");
  } else if (totalPoints >= 8) {
    await saveProfileScreenshot(page, "Yes/Tinder");
    await randomScroll(page);
    consoleLogWithStyle("Match", "32");
    await decideLikeOrNope(page, "Sim");
  } else {
    consoleLogWithStyle("Nope", "31");
    await decideLikeOrNope(page, "Não");
  }
}

async function saveProfileScreenshot(page, folder) {
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
  const fileName = folder + `/TinderPic_${timestamp}.png`;

  fs.writeFileSync(fileName, screenshotBuffer);
}

module.exports = {
  runTinderInteraction,
};
