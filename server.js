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
        // Reduzido para 5 iterações
        const distance = randomBetween(-500, 500); // Maior distância de rolagem
        currentPosition += distance;
        currentPosition = Math.min(Math.max(currentPosition, 0), totalHeight);

        elemento.scrollTo(0, currentPosition);
        await new Promise((resolve) =>
          setTimeout(resolve, randomBetween(200, 500))
        ); // Tempo de espera reduzido
      }
    }
  });
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
        return true; // Indica que o botão foi clicado
      }
    }
    return false; // Indica que o botão não foi encontrado
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

(async () => {
  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars", // Tenta ocultar a barra de informações
      "--start-maximized", // Inicia com a janela maximizada
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
    headless: false,
    userDataDir: "/home/jorge/puppeteer_data", //@todo colocar em .env
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
  );
  await page.goto("https://tinder.com/app/recs", { waitUntil: "load" });

  let countLikes = 0;
  let countNopes = 0;
  let countNopesRadons = 0;

  /**
   * Updates the console message with the current counts of 'Likes' and 'Nopes'.
   * The message is updated on the same line for better visibility.
   *
   * @param {number} countLikes - The current count of 'Likes'.
   * @param {number} countNopes - The current count of 'Nopes'.
   * @param {number} countNopesRadons - The current count of 'Nopes' in randon function.
   */
  function reloadMessageConsole() {
    const likeMessage = `Working -- Likes: \x1b[32m${countLikes}\x1b[0m`;
    const deslikeMessage = `, Nope: \x1b[31m${countNopes}\x1b[0m`;
    const deslikeMessageRadon = `, NopeRandons: \x1b[33m${countNopesRadons}\x1b[0m`;
    process.stdout.write(
      `\r\x1b[37m${likeMessage}${deslikeMessage}${deslikeMessageRadon}`
    );
  }

  /**
   * Decides whether to like or nope based on the blacklist words.
   * @param {object} page - Puppeteer page object.
   * @param {string[]} blackListWords - Array of blacklist words.
   */
  async function decideLikeOrNope(page, blackListWords) {
    const blackList = await findWordsInPage(page, blackListWords);

    const randomDecision = Math.random() < 0.9 ? "Curti" : "Não";

    if (blackList) {
      await clickAction(page, "Não");
      countNopes++;
      reloadMessageConsole();
    } else {
      await clickAction(page, randomDecision);
      if (randomDecision === "Curti") {
        countLikes++;
      } else {
        countNopesRadons++;
      }
      reloadMessageConsole();
    }

    await sleep(1000);
  }

  while (true) {
    await sleep(1000);
    let selectorVisible = await isSelectorVisible(
      page,
      "span.Typs\\(display-1-strong\\)"
    );

    await rejectSuperLike(page);

    if (selectorVisible) {
      await sleep(1000);
      await openProfile(page);
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('button[type="button"]')).some(
          (button) => button.textContent.includes("Denunciar")
        )
      );
      await randomScroll(page);
      await decideLikeOrNope(page, process.env.BLACKLIST_WORDS.split(","));
    } else {
      consoleLogWithStyle("erro de execução. tentando novamente...", "31");
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
})();
