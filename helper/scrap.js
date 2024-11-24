import puppeteer from "puppeteer";
import fs from "fs/promises";
import { connectToDatabase, scrapData } from "./db.js"; // Import MongoDB connection and model
import mongoose from "mongoose";

// Limit the number of concurrent tasks
const CONCURRENT_TASKS = 10;

async function extractPageData(browser, url,links) {
  let page;
  try {
    // Create a new page for each URL
    page = await browser.newPage();
    console.log("scraping link : "+links)

    // Attempt to load the page with retry mechanism
    let retries = 3;
    while (retries > 0) {
      try {
        // Navigate to the URL with increased timeout
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Extract the title
        const title = await page.$eval("h1 span", (el) => el.innerText.trim());

        // Extract iframe src
        const pdfUrl = await page.$eval("iframe.pdf", (iframe) => iframe.src);

        // Return the result
        return { tagString: "Indian culture <-> Rare books", title:title, pdfUrl:pdfUrl };
      } catch (error) {
        console.error(
          `Error navigating or extracting from URL: ${url}, Retry attempts left: ${
            retries - 1
          }`
        );
        retries -= 1;
        if (retries === 0) {
          console.error("Max retries reached for URL:", url);
          return null; // Return null after max retries
        }
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  } catch (error) {
    console.error("Error extracting data for URL:", url, error.message);
    return null; // Return null for failed URLs
  } finally {
    if (page) {
      await page.close(); // Always close the page
    }
  }
}

async function processUrls() {
  let browser;
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Read and parse JSON file
    const data = await fs.readFile("scraped_links_1.json", "utf8");
    const urls = JSON.parse(data);

    // Launch Puppeteer browser
    browser = await puppeteer.launch();

    // Process URLs in batches
    const results = [];
    for (let i = 0; i < urls.length; i += CONCURRENT_TASKS) {
      const batch = urls.slice(i, i + CONCURRENT_TASKS);

      try {
        const batchResults = await Promise.all(
          batch.map((url,i) => extractPageData(browser, url,i))
        );
        results.push(...batchResults.filter((result) => result !== null));
      } catch (error) {
        console.error("Error processing batch:", error.message);
      }
    }

    // Save results to MongoDB in a single batch
    if (results.length > 0) {
      await scrapData.insertMany(results);
      console.log(`Saved ${results.length} records to MongoDB.`);
    } else {
      console.log("No data to save.");
    }
  } catch (error) {
    console.error("Error processing URLs:", error.message);
  } finally {
    // Ensure Puppeteer and MongoDB connections are closed
    if (browser) await browser.close();
    mongoose.disconnect();
  }
}

processUrls().catch(console.error);

