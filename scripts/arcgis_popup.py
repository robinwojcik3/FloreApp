import json
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException


URL = "https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100&scale=577790.554289"


def get_driver(browser="chrome"):
    """Return a WebDriver instance for Chrome or Firefox."""
    if browser == "firefox":
        return webdriver.Firefox()
    return webdriver.Chrome()


def switch_to_map_frame(driver):
    """If the map is inside an iframe, switch to it."""
    try:
        # look for iframe containing the map by id or other attribute
        iframe = driver.find_element(By.CSS_SELECTOR, "iframe")
        driver.switch_to.frame(iframe)
    except NoSuchElementException:
        pass


def switch_to_popup_frame(driver):
    """If popup content is inside an iframe, switch to it."""
    try:
        iframe = driver.find_element(By.CSS_SELECTOR, "iframe")
        driver.switch_to.frame(iframe)
    except NoSuchElementException:
        pass


def main(browser="chrome"):
    driver = get_driver(browser)
    driver.get(URL)

    try:
        # wait for map element to be present and clickable
        WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "#map_gc"))
        )
        switch_to_map_frame(driver)
        map_element = driver.find_element(By.CSS_SELECTOR, "#map_gc")
        map_element.click()

        try:
            # wait for Ressources button if it exists
            ressources_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Ressources')]"))
            )
            ressources_button.click()
        except TimeoutException:
            pass

        # handle popup or new page
        try:
            switch_to_popup_frame(driver)
            popup = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located(
                    (
                        By.CSS_SELECTOR,
                        ".esriPopup, .esri-popup, .esri-popup__main"
                    )
                )
            )
            text = popup.text
        except TimeoutException:
            text = ""

        print(json.dumps({"text": text}, ensure_ascii=False))
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
    finally:
        driver.quit()


if __name__ == "__main__":
    browser = sys.argv[1] if len(sys.argv) > 1 else "chrome"
    main(browser)
