"""Interact with an ArcGIS map and return popup text using Selenium."""
import json
import sys
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

URL = (
    "https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100&scale=577790.554289"
)


def get_driver(browser: str = "chrome"):
    """Return a Chrome or Firefox WebDriver."""
    if browser.lower() == "firefox":
        return webdriver.Firefox()
    return webdriver.Chrome()


def switch_to_frame_containing(driver, selector: str, timeout: int = 10):
    """Switch to the iframe containing the element matching ``selector``."""
    wait = WebDriverWait(driver, timeout)
    try:
        return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
    except TimeoutException:
        for frame in driver.find_elements(By.TAG_NAME, "iframe"):
            driver.switch_to.frame(frame)
            try:
                return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
            except TimeoutException:
                driver.switch_to.default_content()
                continue
        raise


def main(browser: str = "chrome"):
    """Open the map, click, and print popup text as JSON."""
    driver = get_driver(browser)
    driver.maximize_window()
    try:
        driver.get(URL)
        wait = WebDriverWait(driver, 20)

        # Click roughly in the middle of the map
        map_elem = switch_to_frame_containing(driver, "#map_gc")
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#map_gc")))
        map_elem.click()
        driver.switch_to.default_content()

        # Click the "Ressources" button if it exists
        try:
            btn = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//*[contains(text(), 'Ressources')]"))
            )
            btn.click()
        except TimeoutException:
            pass

        # Grab text from the popup
        popup = switch_to_frame_containing(driver, ".esriPopup, .esri-popup, .esri-popup__main")
        text = popup.text.strip()
        print(json.dumps({"text": text}, ensure_ascii=False))
    finally:
        driver.quit()


if __name__ == "__main__":
    browser = sys.argv[1] if len(sys.argv) > 1 else "chrome"
    try:
        main(browser)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
