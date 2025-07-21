import logging
from typing import Tuple

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run(lat: float, lon: float) -> str:
    """Launch the Selenium workflow in headless Chrome.

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees.
    lon : float
        Longitude in decimal degrees.

    Returns
    -------
    str
        Status message.
    """
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    service = Service()
    driver = webdriver.Chrome(service=service, options=options)
    try:
        url = f"https://www.arcgis.com/?lat={lat}&lon={lon}"
        driver.get(url)
        logger.info("Opened %s", url)
        # Placeholder for additional workflow actions
        return "ok"
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Workflow failed: %s", exc)
        return "error"
    finally:
        driver.quit()
