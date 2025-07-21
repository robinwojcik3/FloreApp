import json
import argparse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

# URL of the map application to open
URL = (
    "https://www.arcgis.com/apps/webappviewer/index.html?id="
    "bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100"
    "&scale=577790.554289"
)


def switch_to_frame_with_map(driver):
    """Switch into the iframe containing the map element if necessary."""
    driver.switch_to.default_content()
    if driver.find_elements(By.CSS_SELECTOR, "#map_gc"):
        return True

    for frame in driver.find_elements(By.TAG_NAME, "iframe"):
        driver.switch_to.frame(frame)
        if driver.find_elements(By.CSS_SELECTOR, "#map_gc"):
            return True
        driver.switch_to.default_content()
    return False


def click_center(element, driver):
    """Click in the center of an element."""
    from selenium.webdriver.common.action_chains import ActionChains

    size = element.size
    ActionChains(driver).move_to_element_with_offset(
        element, size["width"] / 2, size["height"] / 2
    ).click().perform()


def extract_popup_text(driver):
    """Retrieve text from the popup, searching in iframes if needed."""
    selectors = [".esriPopup", ".esri-popup", ".esri-popup__main"]

    def find_text():
        for sel in selectors:
            for el in driver.find_elements(By.CSS_SELECTOR, sel):
                if el.text.strip():
                    return el.text.strip()
        return ""

    text = find_text()
    if text:
        return text

    for frame in driver.find_elements(By.TAG_NAME, "iframe"):
        driver.switch_to.frame(frame)
        text = find_text()
        driver.switch_to.default_content()
        if text:
            return text
    return ""


def main(browser: str = "chrome"):
    """Run the automation sequence."""
    if browser == "firefox":
        driver = webdriver.Firefox()
    else:
        driver = webdriver.Chrome()

    try:
        driver.get(URL)

        # Switch into the iframe that contains the map if required
        WebDriverWait(driver, 30).until(lambda d: switch_to_frame_with_map(d))

        # Wait until the map is clickable and click its center
        map_el = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "#map_gc"))
        )
        click_center(map_el, driver)

        # Click on the Ressources button if it appears
        try:
            resources = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//span[normalize-space()='Ressources']/parent::*")
                )
            )
            resources.click()
        except TimeoutException:
            pass

        # Wait for popup text and output it
        WebDriverWait(driver, 10).until(lambda d: extract_popup_text(d))
        text = extract_popup_text(driver)
        if text:
            print(json.dumps({"text": text}, ensure_ascii=False, indent=2))
        else:
            print("No popup text found")
    finally:
        driver.quit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--browser",
        choices=["chrome", "firefox"],
        default="chrome",
        help="Choose the WebDriver to use",
    )
    args = parser.parse_args()
    main(args.browser)
