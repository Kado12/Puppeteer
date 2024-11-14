const puppeteer = require('puppeteer')
const fs = require('fs').promises
const dotenv = require('dotenv')
dotenv.config()

const scrapePage = async (url) => {
  try {
    // Iniciar el navegador
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    console.log('Navegador iniciado')

    // Crear una nueva página
    const page = await browser.newPage()

    // Configurar el TimeOut más largo para sitios lentos
    page.setDefaultNavigationTimeout(60000)

    //Ir a la URL
    console.log(`Navegando a ${url}`)
    await page.goto(url, {
      waitUntil: 'networkidle0' // Esperar hasta que la red esté inactiva
    })

    // Extraer toda la información visible
    const data = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        content: [],
        products: []
      }
      // Obtener todo el texto visible
      function extractText(element) {
        const text = element.textContent.trim()
        if (text) result.content.push(text)

        // Recursivamente extraer texto de elementos hijos
        for (const child of element.children) {
          extractText(child)
        }
      }

      extractText(document.body)

      // Intentar encontrar productos (ajusta los selectores según tu sitio web)
      const productElements = document.querySelectorAll('.product, [class*="product"], [id*="product"]')

      productElements.forEach(product => {
        const productData = {
          title: product.querySelector('h1, h2, h3, .title')?.textContent?.trim() || '',
          price: product.querySelector('.price, [class*="price"]')?.textContent?.trim() || '',
          description: product.querySelector('.description, [class*="description"]')?.textContent?.trim() || '',
          image: product.querySelector('img')?.src || ''
        }

        if (productData.title || productData.price || productData.description) {
          result.products.push(productData)
        }
      })

      return result
    })

    // Obtener todos los enlaces de la página
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href.startsWith('http'))
    )

    // Almacenar los enlaces en el objeto de datos
    data.links = [...new Set(links)] // Eliminar duplicados

    // Guardar los datos en un archivo
    const filename = 'website_data.txt'
    await fs.writeFile(filename, JSON.stringify(data, null, 2))
    console.log(`Datos guardados en ${filename}`)

    // Cerrar el navegador
    await browser.close()
    console.log('Navegador cerrado')

    return data

  } catch (error) {
    console.error('Error durante el scraping:', error)
    throw error
  }
}

// Función principal para ejecutar el scraper
async function main() {
  try {
    const url = process.env.URL_WEB_PAGE // Reemplazar con tu URL
    const data = await scrapePage(url)
    console.log('Scraping completado exitosamente')
  } catch (error) {
    console.error('Error en la ejecución principal:', error)
  }
}

// Ejecutar el script
main()