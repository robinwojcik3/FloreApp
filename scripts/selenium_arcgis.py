import json
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# URL de la carte ArcGIS 
ARC_GIS_URL = (
    "https://www.arcgis.com/apps/webappviewer/index.html?id="
    "bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100&scale=577790.554289"
)


def main():
    """Automatise l'ouverture de la page ArcGIS et récupère le texte du popup."""
    # Essayez de lancer Chrome puis Firefox en dernier recours
    driver = None
    try:
        try:
            driver = webdriver.Chrome()
        except Exception:
            driver = webdriver.Firefox()

        driver.maximize_window()
        driver.get(ARC_GIS_URL)

        # Passage éventuel dans une iframe contenant la carte
        try:
            frame = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "iframe"))
            )
            driver.switch_to.frame(frame)
        except TimeoutException:
            pass  # pas d'iframe détectée

        # Clic au centre de la carte
        map_elem = WebDriverWait(driver, 15).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "#map_gc"))
        )
        map_elem.click()

        # Attente et clic sur le bouton "Ressources" s'il existe
        try:
            res_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//*[contains(text(),'Ressources')]") )
            )
            res_button.click()
        except TimeoutException:
            pass

        # Recherche du contenu du popup
        popup_sel = ".esriPopup, .esri-popup, .esri-popup__main, .dijitPopup"
        text = ""
        try:
            popup = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, popup_sel))
            )
            text = popup.text.strip()
        except TimeoutException:
            pass

        result = {"popup_text": text}
        print(json.dumps(result, ensure_ascii=False))
    except Exception as err:
        print(f"Erreur: {err}", file=sys.stderr)
    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    main()
