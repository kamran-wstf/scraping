import puppeteer from "puppeteer";
import fs from "fs";
import pLimit from "p-limit";

const MAX_CONCURRENT_PAGES = 10; // Limit of parallel pages

// Function to start the browser
const startBrowser = async () => {
  try {
    console.log("Opening the browser...");
    return await puppeteer.launch({
      product: "chrome",
      channel: "chrome",
      args: ["--disable-setuid-sandbox"],
      ignoreHTTPSErrors: true,
    });
  } catch (err) {
    console.error("Could not start the browser: ", err);
    throw err;
  }
};

// Function to scrape a single page
const scrapePage = async (pageNumber, browser, retries = 3) => {
  const page = await browser.newPage();
  const targetUrl = `https://indianculture.gov.in/gazettes?f%5B0%5D=gazeete_region%3AGazetteer%20Reports&search_api_fulltext=&page=${pageNumber}`;

  try {
    console.log(`Scraping page ${pageNumber}...`);

    // Optimize by blocking unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (["image", "stylesheet", "font"].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate to the target URL with an extended timeout
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Extract links from the page
    const links = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".pdfpreview-image-wrapper a")
      ).map((anchor) => anchor.href);
    });

    console.log(`Page ${pageNumber} links:`, links);
    return links;
  } catch (err) {
    if (retries > 0) {
      console.warn(
        `Retrying page ${pageNumber} (${3 - retries} retries left)...`
      );
      return await scrapePage(pageNumber, browser, retries - 1);
    } else {
      console.error(`Failed to scrape page ${pageNumber}:`, err.message);
      return [];
    }
  } finally {
    await page.close();
  }
};

// Main scraping function with parallel processing
const scrapeAllPages = async () => {
  const browser = await startBrowser();
  const allLinks = [];
  const limit = pLimit(MAX_CONCURRENT_PAGES); // Concurrency control

  try {
    const totalPages = 115; // Total number of pages to scrape
    const scrapeTasks = Array.from({ length: totalPages + 1 }, (_, i) =>
      limit(() => scrapePage(i, browser))
    );

    const results = await Promise.all(scrapeTasks);

    results.forEach((links, index) => {
    
      console.log(`Links from page ${index}:`, links);
      allLinks.push(...links);
    });

    // Save all links to a JSON file
    fs.writeFileSync(
      "scraped_links_1.json",
      JSON.stringify(allLinks, null, 2),
      "utf-8"
    );
    console.log("Scraping completed. Links saved to scraped_links2.json");
  } catch (err) {
    console.error("Error during scraping: ", err.message);
  } finally {
    await browser.close();
  }
};

// Execute the scraper
(async () => {
  try {
    await scrapeAllPages();
    // Run the script
  } catch (err) {
    console.error("Unhandled error: ", err.message);
  }
})();
