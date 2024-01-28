const puppeteer = require("puppeteer");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatConsoleDate(date) {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();

  return `[${hour}:${minutes}:${seconds}.${milliseconds}]`;
}

function consoleLogWithStyle(message, colorCode = 37) {
  console.log(
    `\x1b[${colorCode}m%s\x1b[0m`,
    `${formatConsoleDate(new Date())} ${message}`,
  );
}

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
          setTimeout(resolve, randomBetween(200, 500)),
        ); // Tempo de espera reduzido
      }
    }
  });
}

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

async function findWordsInPage(page, words) {
  const result = await page.evaluate((words) => {
    const text = document.body.innerText || "";
    return words.some((word) => new RegExp(word, "gi").test(text));
  }, words);

  return result;
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
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  );
  await page.goto("https://tinder.com/app/recs", { waitUntil: "load" });

  let contadorLikes = 0;
  let contadorDeslikes = 0;

  while (true) {
    consoleLogWithStyle(
      `Likes: ${contadorLikes}, Deslikes: ${contadorDeslikes}`,
    );
    await sleep(1000);
    let selectorVisible = await isSelectorVisible(
      page,
      "span.Typs\\(display-1-strong\\)",
    );

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

    if (selectorVisible) {
      await sleep(1000);
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll("button[type='button']"),
        );
        const targetButton = buttons.find((button) => {
          const hiddenSpan = button.querySelector("span.Hidden");
          return hiddenSpan && hiddenSpan.textContent.includes("Abrir perfil");
        });
        if (targetButton) {
          targetButton.click();
        }
      });
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('button[type="button"]')).some(
          (button) => button.textContent.includes("Denunciar"),
        ),
      );

      await randomScroll(page);

      const blackList = await findWordsInPage(page, [

      ]);
      if (!blackList) {
        await clickAction(page, "Curti");
        consoleLogWithStyle("Like clicado", "32");
        contadorLikes++;
        await sleep(1000);
      } else {
        await clickAction(page, "Não");
        consoleLogWithStyle("Deslike clicado", "31");
        contadorDeslikes++;
        await sleep(1000);
      }
    } else {
      consoleLogWithStyle(
        "Seletor ainda não encontrado. Continuando o loop...",
        "31",
      );
      continue; // Pula para a próxima iteração do loop
    }
  }

  async function isSelectorVisible(page, selector) {
    return page
      .waitForSelector(selector, { visible: true, timeout: 5000 })
      .then(() => true) // Seletor encontrado e visível
      .catch(() => false); // Falha ao encontrar o seletor
  }
})();
