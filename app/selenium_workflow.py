import logging
from typing import Tuple

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait

logger = logging.getLogger(__name__)


def _build_driver() -> webdriver.Chrome:
    """Return a headless Chrome WebDriver."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    service = Service("/usr/bin/chromedriver")
    return webdriver.Chrome(service=service, options=options)


def run(lat: float, lon: float) -> str:
    """Run the Selenium workflow for the provided coordinates."""
    logger.info("Starting Selenium workflow for %s, %s", lat, lon)
    driver = _build_driver()
    try:
        url = f"https://www.geoportail.gouv.fr/carte?c={lon},{lat}&z=8"
        logger.info("Loading %s", url)
        driver.get(url)
        WebDriverWait(driver, 10).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        screenshot_path = f"/tmp/map_{lat}_{lon}.png"
        driver.save_screenshot(screenshot_path)
        logger.info("Screenshot saved to %s", screenshot_path)
        status = "ok"
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Workflow failed")
        status = f"error: {exc}"
    finally:
        driver.quit()
    return status
