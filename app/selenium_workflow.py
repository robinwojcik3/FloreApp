import logging
from typing import Any
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

logger = logging.getLogger(__name__)


def run(lat: float, lon: float) -> None:
    """Launch the Selenium workflow with given coordinates."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)
    try:
        logger.info("Starting Selenium workflow lat=%s lon=%s", lat, lon)
        # TODO: implement ArcGIS and Geoportail operations
        driver.get("https://www.google.com")
        logger.debug("Page title: %s", driver.title)
    finally:
        driver.quit()
        logger.info("Workflow finished")
