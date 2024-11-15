const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const dotenv = require('dotenv')
dotenv.config()

// Set para almacenar URLs ya visitadas
const visitedUrls = new Set();

async function scrapePage(url, depth = 0, maxDepth = 2) {
  // Si ya visitamos esta URL o alcanzamos la profundidad máxima, salimos
  if (visitedUrls.has(url) || depth > maxDepth) {
    return null;
  }

  // Agregar URL al set de visitadas
  visitedUrls.add(url);

  try {
    // Iniciar el navegador con opciones adicionales
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    // Crear nueva página con configuraciones optimizadas
    const page = await browser.newPage();

    // Configurar timeouts más largos
    await page.setDefaultNavigationTimeout(120000); // 2 minutos
    await page.setDefaultTimeout(120000);

    // Optimizar el rendimiento
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Bloquear recursos innecesarios
      if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Intentar navegar a la página
    console.log(`Navegando a ${url}... (profundidad: ${depth})`);
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });
    } catch (error) {
      console.error(`Error al navegar a ${url}:`, error.message);
      await browser.close();
      return null;
    }

    // Extraer información
    const data = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        content: []
      };

      function extractText(element) {
        const text = element.textContent
          .trim()
          .replace(/\t/g, ' ')
          .replace(/\s+/g, ' '); // Normalizar espacios

        if (text && text.length > 1) { // Ignorar textos muy cortos
          result.content.push(text);
        }

        for (const child of element.children) {
          extractText(child);
        }
      }

      extractText(document.body);

      return result;
    });

    // Obtener enlaces si no hemos alcanzado la profundidad máxima
    if (depth < maxDepth) {
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.href)
          .filter(href =>
            href.startsWith('http') &&
            // Asegurarse de que el enlace sea del mismo dominio
            new URL(href).hostname === window.location.hostname
          );
      });

      // Procesar subpáginas de forma secuencial para evitar sobrecarga
      const uniqueLinks = [...new Set(links)];
      data.subpages = [];

      for (const link of uniqueLinks) {
        if (!visitedUrls.has(link)) {
          const subpageData = await scrapePage(link, depth + 1, maxDepth);
          if (subpageData) {
            data.subpages.push(subpageData);
          }
        }
      }
    }

    // Cerrar el navegador
    await browser.close();

    // Guardar los datos en un archivo
    const filename = `website_data_${depth}.txt`;
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`Datos guardados en ${filename}`);

    return data;

  } catch (error) {
    console.error(`Error durante el scraping de ${url}:`, error.message);
    return null;
  }
}

async function main() {
  try {
    const url = process.env.URL_WEB_PAGE; // Reemplaza con tu URL
    console.log('Iniciando scraping...');
    const data = await scrapePage(url);
    console.log('Scraping completado exitosamente');
  } catch (error) {
    console.error('Error en la ejecución principal:', error.message);
  }
}

main();