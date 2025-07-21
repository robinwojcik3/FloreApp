import logging
from typing import Tuple

from selenium import webdriver
from selenium.webdriver.chrome.options import Options


logger = logging.getLogger(__name__)


def _create_driver() -> webdriver.Chrome:
    """Return a configured headless Chrome driver."""
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    driver = webdriver.Chrome(options=chrome_options)
    return driver


def run(lat: float, lon: float) -> str:
    """Execute the Selenium workflow.

    Navigates to Google Maps at the provided coordinates and takes a screenshot.
    Returns a status string.
    """
    logger.info("Starting Selenium workflow for %s, %s", lat, lon)
    driver = _create_driver()
    try:
        url = f"https://www.google.com/maps/@{lat},{lon},10z"
        driver.get(url)
        logger.info("Navigated to %s", url)
        driver.save_screenshot("workflow.png")
        logger.info("Screenshot saved")
        return "success"
    except Exception as exc:  # pragma: no cover - logging only
        logger.exception("Workflow failed: %s", exc)
        return "error"
    finally:
        driver.quit()
