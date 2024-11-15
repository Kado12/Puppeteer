const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const dotenv = require('dotenv')
dotenv.config()

async function scrapePage(url) {
  try {
    // Iniciar el navegador
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Crear una nueva página
    const page = await browser.newPage();

    // Configurar timeout más largo
    page.setDefaultNavigationTimeout(60000);

    // Ir a la URL
    await page.goto(url, {
      waitUntil: 'networkidle0'
    });

    // Extraer toda la información visible
    const data = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        content: []
      };

      // Función para extraer texto
      function extractText(element) {
        const text = element.textContent.trim().replace(/\t/g, '');
        if (text) result.content.push(text);

        for (const child of element.children) {
          extractText(child);
        }
      }

      extractText(document.body);

      return result;
    });

    // Obtener enlaces de la página
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href.startsWith('http'))
    );

    // Obtener datos de subpáginas
    const subpageData = await Promise.all(links.map(async (link) => {
      try {
        return await scrapePage(link);
      } catch (error) {
        console.error(`Error en subpágina ${link}:`, error);
        return null;
      }
    }));

    // Agregar datos de subpáginas al resultado principal
    data.subpages = subpageData.filter(Boolean);

    // Guardar los datos en un archivo
    const filename = 'website_data.txt';
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`Datos guardados en ${filename}`);

    // Cerrar el navegador
    await browser.close();

    return data;

  } catch (error) {
    console.error('Error durante el scraping:', error);
    throw error;
  }
}

// Función principal
async function main() {
  try {
    const url = process.env.URL_WEB_PAGE;
    const data = await scrapePage(url);
    console.log('Scraping completado exitosamente');
  } catch (error) {
    console.error('Error en la ejecución principal:', error);
  }
}

main();