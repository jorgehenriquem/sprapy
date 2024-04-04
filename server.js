require("dotenv").config();

const puppeteer = require("puppeteer");

/**
 * Waits for the given number of milliseconds.
 * @param {number} ms - Number of milliseconds to wait.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formats the given Date object into a string representation.
 * The format used is [hour:minutes:seconds.milliseconds].
 *
 * @param {Date} date - The Date object to be formatted.
 * @returns {string} A string representing the formatted date.
 */
function formatConsoleDate(date) {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();

  return `[${hour}:${minutes}:${seconds}.${milliseconds}]`;
}

/**
 * Logs a message to the console with a specific color and a timestamp.
 * The timestamp is generated using the `formatConsoleDate` function.
 *
 * @param {string} message - The message to be logged.
 * @param {number} [colorCode=37] - The ANSI color code for the text color. Default is 37 (white).
 */
function consoleLogWithStyle(message, colorCode = 37) {
  console.log(
    `\x1b[${colorCode}m%s\x1b[0m`,
    `${formatConsoleDate(new Date())} ${message}`
  );
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
 * Clicks a specified action button on the page.
 * @param {object} page - Puppeteer page object.
 * @param {string} action - The action to perform (e.g., 'Curti', 'Não').
 */
async function clickAction(page, action) {
  const delay = Math.random() * 3000 + 2000;
  await sleep(delay);
  await page.evaluate((action) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const button of buttons) {
      const hiddenSpan = button.querySelector("span.Hidden");
      if (hiddenSpan && hiddenSpan.textContent.trim() === action) {
        button.click();
        return true;
      }
    }
    return false;
  }, action);
}

/**
 * Finds if any of the specified words exist on the page.
 * @param {object} page - Puppeteer page object.
 * @param {string[]} words - Array of words to find.
 */
async function findWordsInPage(page, words) {
  const result = await page.evaluate((words) => {
    const text = document.body.innerText || "";
    return words.some((word) => new RegExp(word, "gi").test(text));
  }, words);

  return result;
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

/**
 * Decides whether to like or nope based on the blacklist words.
 * @param {object} page - Puppeteer page object.
 * @param {string[]} blackListWords - Array of blacklist words.
 */
async function decideLikeOrNope(page, blackListWords) {
  const blackList = await findWordsInPage(page, blackListWords);
  const bioOnlyInsta = await singleInstaBioVerification(page);

  const randomDecision = Math.random() < 0.9 ? "Curti" : "Não";

  if (blackList || bioOnlyInsta) {
    await clickAction(page, "Não");
    reloadMessageConsole("não", bioOnlyInsta, "tinder");
  } else {
    await clickAction(page, randomDecision);
    reloadMessageConsole("sim", bioOnlyInsta, "tinder");
  }

  await sleep(1000);
}

/**
 * Decides whether to like or nope based on the blacklist words.
 * @param {object} page - Puppeteer page object.
 * @param {string[]} blackListWords - Array of blacklist words.
 */
async function decideLikeOrNopeBumble(page, blackListWords) {
  const blackList = await findWordsInPage(page, blackListWords);
  const bioOnlyInsta = await singleInstaBioVerificationBumble(page);

  const randomDecision = Math.random() < 0.9 ? "sim" : "nao";
  await sleep(1000);

  if (blackList || bioOnlyInsta) {
    await clickActionBumble(page, "nao");
    if (!bioOnlyInsta) {
      countNopesBumble++;
    } else {
      countNopesInstaBumble++;
    }
    reloadMessageConsole("nao", bioOnlyInsta, "bumble");
  } else {
    await clickActionBumble(page, randomDecision);
    if (randomDecision === "sim") {
      countLikesBumble++;
    } else {
      countNopesRadonsBumble++;
    }
    reloadMessageConsole(randomDecision, bioOnlyInsta, "bumble");
  }

  await sleep(1000);
}

/**
 * Clicks a specified action button on the page.
 * @param {object} page - Puppeteer page object.
 * @param {string} action - The action to perform (e.g., 'Sim', 'Não').
 */

async function clickActionBumble(page, answer) {
  await sleep(1000);
  try {
    if (answer.toLowerCase() === "sim") {
      await page.click(".encounters-action--like");
    } else if (answer.toLowerCase() === "nao") {
      await page.click(".encounters-action--dislike");
    } else {
      console.log('Resposta inválida. Por favor, insira "sim" ou "nao".');
    }
  } catch {
    await page.reload();
  }
}

let countLikes = 0;
let countNopes = 0;
let countNopesRadons = 0;
let countNopesInsta = 0;

let countLikesBumble = 0;
let countNopesBumble = 0;
let countNopesRadonsBumble = 0;
let countNopesInstaBumble = 0;

/**
 * Updates the console message with the current counts of 'Likes' and 'Nopes'.
 * The message is updated on the same line for better visibility.
 *
 * @param {string} decision - The decision made ('sim' or 'não').
 * @param {boolean} isInsta - Whether the decision was made based on an Instagram bio.
 */
function reloadMessageConsole(decision, isInsta, origin) {
  if (origin == "bumble") {
    if (decision === "sim") {
      countLikesBumble++;
    } else {
      if (!isInsta) {
        countNopesBumble++;
      } else {
        countNopesInstaBumble++;
      }
    }
  } else {
    if (decision === "sim") {
      countLikes++;
    } else {
      if (!isInsta) {
        countNopes++;
      } else {
        countNopesInsta++;
      }
    }
  }
  const likeMessageBumble = `\x1b[1mBumble\x1b[0m - Likes: \x1b[32m${countLikesBumble}\x1b[0m`;
  const deslikeMessageBumble = `, Nope: \x1b[31m${countNopesBumble}\x1b[0m`;
  const deslikeMessageRadonBumble = `, NopeRandons: \x1b[33m${countNopesRadonsBumble}\x1b[0m`;
  const deslikeMessageInstasBumble = `, NopeInsta: \x1b[30m${countNopesInstaBumble}\x1b[0m`;

  const likeMessage = `\x1b[1mTinder\x1b[0m - Likes: \x1b[32m${countLikes}\x1b[0m`;
  const deslikeMessage = `, Nope: \x1b[31m${countNopes}\x1b[0m`;
  const deslikeMessageRadon = `, NopeRandons: \x1b[33m${countNopesRadons}\x1b[0m`;
  const deslikeMessageInstas = `, NopeInsta: \x1b[30m${countNopesInsta}\x1b[0m`;

  process.stdout.write(
    `\r\x1b[37m${likeMessage}${deslikeMessage}${deslikeMessageRadon}${deslikeMessageInstas} ${likeMessageBumble}${deslikeMessageBumble}${deslikeMessageRadonBumble}${deslikeMessageInstasBumble}`
  );
}

/**
 * Manipulates each page independently
 * @param {object} page - Puppeteer page object
 */
async function handlePage(page, site) {
  while (true) {
    await sleep(1000);
    if (site === "tinder") {
      let selectorVisible = await isSelectorVisible(
        page,
        "span.Typs\\(display-1-strong\\)"
      );
      if (selectorVisible) {
        await sleep(1000);
        await openProfile(page);
        try {
          await page.waitForFunction(
            () =>
              Array.from(
                document.querySelectorAll('button[type="button"]')
              ).some((button) => button.textContent.includes("Denunciar")),
            { timeout: 20000 }
          );
          await randomScroll(page);
          await decideLikeOrNope(page, process.env.BLACKLIST_WORDS.split(","));
        } catch (error) {
          consoleLogWithStyle(
            "Erro de tempo limite ao esperar pela função:",
            "31"
          );

          await page.reload();
        }
      } else {
        consoleLogWithStyle(
          "erro de execução. tentando novamente.......",
          "31"
        );
        await sleep(2000);
      }
    }

    await rejectSuperLike(page);
  }
}

/**
 * Handles the interaction logic for Bumble pages.
 *
 * This function continuously handles the interaction logic for Bumble pages,
 * including random arrow presses and decision making based on blacklisted words.
 *
 * @param {object} page - Puppeteer page object.
 * @param {string} site - The site identifier ("bumble").
 * @returns {Promise<void>} A Promise that resolves when the interaction logic is stopped.
 */
async function handlePageBumble(page, site) {
  while (true) {
    await sleep(1000);
    if (site === "bumble") {
      await randomArrow(page);
      await decideLikeOrNopeBumble(
        page,
        process.env.BLACKLIST_WORDS.split(",")
      );
    }
  }
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

  const page1 = await browser.newPage();
  const page2 = await browser.newPage();

  await page1.setViewport({ width: 1920, height: 1080 });
  await page1.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
  );
  await page1.goto("https://tinder.com/app/recs", { waitUntil: "load" });

  await page2.setViewport({ width: 1920, height: 1080 });
  await page2.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
  );
  await page2.goto("https://bumble.com/app", { waitUntil: "load" });

  await Promise.all([
    handlePageBumble(page2, "bumble"),
    handlePage(page1, "tinder"),
  ]);
})();
