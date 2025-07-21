import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

logger = logging.getLogger(__name__)


def run(lat: float, lon: float) -> None:
    """Launch the Selenium workflow using provided coordinates."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(options=options)
    try:
        url = f"https://www.geoportail.gouv.fr/carte?c={lon},{lat}&z=10"
        logger.info("Opening %s", url)
        driver.get(url)
        driver.save_screenshot("/tmp/selenium_workflow.png")
        logger.info("Screenshot saved")
    except Exception as exc:  # pragma: no cover - runtime errors
        logger.exception("Workflow failed: %s", exc)
    finally:
        driver.quit()
