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
  let swipeCount = 0;
  let likeCount = 0;
  const MAX_SWIPES = 300;
  const MAX_LIKES = 75; // 25% de 300
  
  while (swipeCount < MAX_SWIPES) {
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
        swipeCount++;
        consoleLogWithStyle(`Swipes realizados: ${swipeCount}/${MAX_SWIPES}`, "35");
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
      const geminiKeys = [
        process.env.GEMINI_KEY,
        process.env.GEMINI_KEY2,
        process.env.GEMINI_KEY3,
      ];
      const randomKey = geminiKeys[Math.floor(Math.random() * geminiKeys.length)];
      const genAI = new GoogleGenerativeAI(randomKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
      const prompt = process.env.PROMPT_IMAGE;
      const image = {
        inlineData: {
          data: Buffer.from(fs.readFileSync("TinderPic.png")).toString(
            "base64"
          ),
          mimeType: "image/png",
        },
      };
      const result = await model.generateContent([prompt, image]);
      await sleep(1000);
      const response = await result.response;
      const text = response.text();
      // console.log("Resposta do gemini:" + text);
      try {
        await page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll('button[type="button"]')).some(
              (button) => button.textContent.includes("Hide") || button.textContent.includes("Ocultar")
            ),
          { timeout: 20000 }
        );
        const gaveLike = await matchPoints(text, page, { likeCount, MAX_LIKES });
        swipeCount++;
        if (gaveLike) {
          likeCount++;
          consoleLogWithStyle(`Likes dados: ${likeCount}/${MAX_LIKES}`, "36");
        }
        consoleLogWithStyle(`Swipes realizados: ${swipeCount}/${MAX_SWIPES}`, "35");
      } catch (error) {
        consoleLogWithStyle(error.message, "31");
        await decideLikeOrNope(page, "Não");
        swipeCount++;
        consoleLogWithStyle(`Swipes realizados: ${swipeCount}/${MAX_SWIPES}`, "35");
        consoleLogWithStyle("Não Pelo erro", "31");
      }
    } catch (error) {
      consoleLogWithStyle(error.message, "31");
      await randomScroll(page);
      await decideLikeOrNope(page, "Não");
      swipeCount++;
      consoleLogWithStyle(`Swipes realizados: ${swipeCount}/${MAX_SWIPES}`, "35");
      consoleLogWithStyle("Não Pelo erro 2", "31");
    }

    await rejectSuperLike(page);
  }
  
  consoleLogWithStyle(`Limite de ${MAX_SWIPES} swipes atingido. Encerrando...`, "33");
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
  await page.keyboard.press("ArrowUp");
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

async function matchPoints(tinderJson, page, { likeCount, MAX_LIKES }) {
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

  if (totalPoints >= 14) {
    // 60% de chance de like
    const random = Math.random();
    if (random < 0.6 && likeCount < MAX_LIKES) {
      await saveProfileScreenshot(page, "Yes/Tinder/Sup");
      await randomScroll(page);
      consoleLogWithStyle("Mega Match! (60% like)", "34");
      await decideLikeOrNope(page, "Sim");
      return true;
    } else {
      if (likeCount >= MAX_LIKES) {
        consoleLogWithStyle("Limite de likes atingido! Dando nope...", "33");
      } else {
        consoleLogWithStyle("Mega Match! (40% nope)", "31");
      }
      await saveProfileScreenshot(page, "Nopes/Tinder");
      await decideLikeOrNope(page, "Não");
      return false;
    }
  } else if (totalPoints >= 8) {
    // 40% de chance de like
    const random = Math.random();
    if (random < 0.4 && likeCount < MAX_LIKES) {
      await saveProfileScreenshot(page, "Yes/Tinder");
      await randomScroll(page);
      consoleLogWithStyle("Match (40% like)", "32");
      await decideLikeOrNope(page, "Sim");
      return true;
    } else {
      if (likeCount >= MAX_LIKES) {
        consoleLogWithStyle("Limite de likes atingido! Dando nope...", "33");
      } else {
        consoleLogWithStyle("Match (60% nope)", "31");
      }
      await saveProfileScreenshot(page, "Nopes/Tinder");
      await decideLikeOrNope(page, "Não");
      return false;
    }
  } else {
    // Sempre nope
    consoleLogWithStyle("Nope", "31");
    await saveProfileScreenshot(page, "Nopes/Tinder");
    await decideLikeOrNope(page, "Não");
    return false;
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
