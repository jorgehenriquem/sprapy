const fs = require("fs");
const {
  sleep,
  findWordsInPage,
  clickActionKey,
  reloadMessageConsole,
} = require("../utils/helpers");
const { consoleLogWithStyle } = require("../utils/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const AIHandler = {
  getRandomKey() {
    return [
      process.env.GEMINI_KEY,
      process.env.GEMINI_KEY2,
      process.env.GEMINI_KEY3,
    ][Math.floor(Math.random() * 3)];
  },

  async initialize() {
    const randomGeminiKey = this.getRandomKey();
    this.genAI = new GoogleGenerativeAI(randomGeminiKey);
    this.modelImage = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.modelConversation = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.promptImage = process.env.PROMPT_IMAGE;
    this.promptConversation = process.env.PROMPT_CONVERSATION;
  },

  async prepareImage(screenshotBuffer) {
    this.image = {
      inlineData: {
        data: Buffer.from(screenshotBuffer).toString("base64"),
        mimeType: "image/png",
      },
    };
  },

  async analyzeImage() {
    const result = await this.modelImage.generateContent([this.promptImage, this.image]);
    await sleep(1000);
    const response = await result.response;
    return response.text();
  },

  async analyzeConversation(messages) {
    const result = await this.modelConversation.generateContent([this.promptConversation, messages]);
    const response = await result.response;
    return response.text();
  }
};

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
      await extractBioInfo(page);
      // console.log("Abrindo perfil");
      await sleep(1000);
      const blackList = await findWordsInPage(
        page,
        process.env.BLACKLIST_WORDS.split(",")
      );
      if (blackList) {
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

      await AIHandler.initialize();
      await AIHandler.prepareImage(screenshotBuffer);
      const aiResponse = await AIHandler.analyzeImage();

      try {
        await page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll('button[type="button"]')).some(
              (button) => button.textContent.includes("Denunciar")
            ),
          { timeout: 20000 }
        );
        await matchPoints(aiResponse, page);
      } catch (error) {
        consoleLogWithStyle(error.message, "31");
        const waitMilliseconds = Math.floor(
          Math.random() * (2 * 60 * 1000 - 1 * 60 * 1000 + 1) + 1 * 60 * 1000
        );
        consoleLogWithStyle(
          `Aguardando para atualizar, timeout de ${waitMilliseconds / 1000} segundos`,
          "34"
        );
        await page.waitForTimeout(waitMilliseconds);
        consoleLogWithStyle("Atualizando", "32");
        await page.reload();
      }
    } catch (error) {
      consoleLogWithStyle(error.message, "31");
      await randomScroll(page);
      await decideLikeOrNope(page, "Não");
      consoleLogWithStyle("Não Pelo erro 2", "31");
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
async function singleInstaBioVerification(bioInfo, kilometer = "") {
  // Usa uma expressão regular para encontrar todas as palavras que começam com '@'
  const instaWords = bioInfo.match(/@\w+/g);
  console.log("Distancia", kilometer);

  if (instaWords && instaWords.length > 0) {
    // Remove duplicatas
    const uniqueInstaWords = [...new Set(instaWords)];

    // Adiciona as palavras ao arquivo insta.txt, cada uma em uma nova linha
    uniqueInstaWords.forEach((word) => {
      fs.appendFileSync(
        "insta.txt",
        `https://www.instagram.com/${word} ${kilometer}km\n`
      );
    });

    console.log(
      "Palavras encontradas e adicionadas ao arquivo insta.txt:",
      uniqueInstaWords
    );
  }
}

async function extractBioInfo(page) {
  const bioInfo = await page.evaluate(() => {
    const aboutMeElement = Array.from(document.querySelectorAll("div")).find(
      (div) => div.textContent.trim() === "Sobre mim"
    );

    let kilometerText = "";
    let kilometer = "";

    // Se o elemento for encontrado, retorna o texto da div abaixo dele
    if (aboutMeElement) {
      const kilometerElement = Array.from(
        document.querySelectorAll("div")
      ).find((div) => div.textContent.includes("quilômetros daqui"));
      console.log(kilometerElement);

      const match = kilometerElement.textContent.match(
        /(\d+)\s*quilômetros daqui/
      );
      if (match) {
        kilometerText = match[1]; // Captura o número como texto
      }

      const nextSibling = aboutMeElement.nextElementSibling;
      return {
        bio: nextSibling ? nextSibling.textContent.trim() : null,
        kilometer: kilometerText,
      };
    }

    return { bio: null, kilometer: "" }; // Retorna null se "Sobre mim" não for encontrado
  });

  if (bioInfo.bio) {
    await singleInstaBioVerification(bioInfo.bio, bioInfo.kilometer);
  }

  return bioInfo;
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

/**
 * Matches points based on the provided tinderJson and updates the total points.
 * Logs each matched category, name, and points, and decides whether to like or nope based on the total points.
 *
 * @param {string|object} tinderJson - The JSON string or object containing the Tinder profile data.
 * @param {object} page - Puppeteer page object.
 */
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

  if (totalPoints >= 14) {
    // await saveProfileScreenshot(page, "Yes/Tinder/Sup");
    await randomScroll(page);
    consoleLogWithStyle("Mega Match!", "34");
    await decideLikeOrNope(page, "Sim");
  } else if (totalPoints >= 8) {
    // await saveProfileScreenshot(page, "Yes/Tinder");
    await randomScroll(page);
    consoleLogWithStyle("Match", "32");
    await decideLikeOrNope(page, "Sim");
  } else {
    consoleLogWithStyle("Nope", "31");
    await decideLikeOrNope(page, "Não");
  }
}

/**
 * Saves a screenshot of the profile to the specified folder.
 *
 * @param {object} page - Puppeteer page object.
 * @param {string} folder - The folder where the screenshot will be saved.
 */
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

function formatConversationString(messages) {
  return messages.map((message) => {
    const prefix = message.type === "sent" ? "me:" : "her:";
    return `${prefix} ${message.message}`;
  }).join(" ");
}

async function TinderConversation(page) {
  const { messages } = await extractConversations(page);
  const conversationString = formatConversationString(messages);

  // Inicializar o AIHandler antes de usar
  await AIHandler.initialize();
  
  //mandar contexto de conversa para o AI e pedir a melhor resposta para a conversa com o intuito de manter a conversa fluida e natural
  const aiResponse = await AIHandler.analyzeConversation(conversationString);
}

async function TinderFirstMessage(page) {
  await acessFisrtMatch(page);
}

async function acessFisrtMatch(page) {
  await page.waitForSelector('a[href^="/app/messages/"]');

  const links = await page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll('a[href^="/app/messages/"]')
    );
    return anchors.map(
      (anchor) => `https://tinder.com${anchor.getAttribute("href")}`
    );
  });

  await sayHiMessage(links, page);
}

async function sayHiMessage(links, page) {
  let interactionCount = 0;

  for (const link of links) {
    if (interactionCount >= 15) {
      console.log("Limite de 20 interações atingido.");
      page.close();
    }
    console.log("Acessando:", link);
    await page.goto(link, { waitUntil: "networkidle2" });
    await randomScroll(page);
    await page.waitForSelector('textarea[placeholder="Digite uma mensagem"]');
    const messagesData = JSON.parse(fs.readFileSync("messages.json"));
    const randomMessageObj =
      messagesData[Math.floor(Math.random() * messagesData.length)];
    const messageToSend = randomMessageObj.message;
    await page.type(
      'textarea[placeholder="Digite uma mensagem"]',
      messageToSend,
      { delay: 100 }
    );

    await page.waitForSelector('button[type="submit"] span');
    await page.click('button[type="submit"]');
    await openProfile(page);
    await randomScroll(page);
    interactionCount++;
    await page.waitForTimeout(
      Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000
    );
  }
}

async function extractConversations(page) {
  await page.waitForSelector('[aria-label="Histórico de conversas"]');
  await page.waitForSelector(".profileContent");
  await sleep(1000);

  const messages = await page.evaluate(() => {
    let messageHelpers = document.querySelectorAll(".msgHelper");
    let messagesArray = [];

    messageHelpers.forEach((msgHelper, index) => {
      console.log(`Mensagem ${index + 1}:`, msgHelper.innerHTML);

      let timeElement = msgHelper.querySelector("time");
      let messageElement = msgHelper.querySelector(".msg .text");

      if (timeElement && messageElement) {
        let messageType = "unknown"; // Default para "unknown"

        if (msgHelper.querySelector(".msgBackground--received")) {
          messageType = "received";
        }
        if (msgHelper.innerHTML.includes("send")) {
          messageType = "sent";
        }

        messagesArray.push({
          time: timeElement.getAttribute("datetime"),
          message: messageElement.innerText.trim(),
          type: messageType,
        });
      }
    });

    return { count: messageHelpers.length, messages: messagesArray };
  });

  return messages;
}

module.exports = {
  runTinderInteraction,
  TinderConversation,
  TinderFirstMessage,
};
