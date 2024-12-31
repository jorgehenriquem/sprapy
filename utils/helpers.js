function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Finds if any of the specified words exist on the page.
 * @param {object} page - Puppeteer page object.
 * @param {string[]} words - Array of words to find.
 */
async function findWordsInPage(page, words) {
  const foundWord = await page.evaluate((words) => {
    const text = document.body.innerText || "";
    return words.find((word) => {
      if (new RegExp(word, "gi").test(text)) {
        return word;
      }
      return null;
    });
  }, words);

  if (foundWord) {
    console.log("palavra encontrada: " + foundWord);
  }

  return !!foundWord;
}

async function findWordsInPages(page, words) {
  await page.waitForTimeout(800); // Use page.waitForTimeout instead of sleep
  const element = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    return bodyText;
  });

  for (let i = 0; i < words.length; i++) {
    if (element.includes(words[i])) {
      return true;
    }
  }
}

async function clickActionKey(page, action) {
  if (action === "Sim") {
    await page.keyboard.press("ArrowRight");
  } else {
    await page.keyboard.press("ArrowLeft");
  }
}

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
  const deslikeBLBumble = `, NopeBLTB: \x1b[30m${countNopesBlackListBumble}\x1b[0m`;

  const likeMessage = `\x1b[1mTinder\x1b[0m - Likes: \x1b[32m${countLikes}\x1b[0m`;
  const deslikeMessage = `, Nope: \x1b[31m${countNopes}\x1b[0m`;
  const deslikeMessageRadon = `, NopeRandons: \x1b[33m${countNopesRadons}\x1b[0m`;
  const deslikeMessageInstas = `, NopeInsta: \x1b[30m${countNopesInsta}\x1b[0m`;
  const deslikeBLTinder = `, NopeBLT: \x1b[30m${countNopesBlackListTinder}\x1b[0m`;

  process.stdout.write(
    `\r\x1b[37m${likeMessage}${deslikeMessage}${deslikeMessageRadon}${deslikeMessageInstas}${deslikeBLTinder} ${likeMessageBumble}${deslikeMessageBumble}${deslikeMessageRadonBumble}${deslikeMessageInstasBumble}${deslikeBLBumble}`
  );
}

module.exports = {
  sleep,
  randomBetween,
  findWordsInPage,
  clickActionKey,
  reloadMessageConsole,
};
