# -*- coding: utf-8 -*-

"""
Script Selenium pour ArcGIS et Geoportail

Auteur    : Robin Wojcik – Améten
Date      : 2025-07-08 (Version allégée et optimisée)

Description
-----------
Ce script exécute deux workflows Selenium en parallèle dans des onglets distincts :
  1. ArcGIS WebAppViewer : réglage de la visibilité et de la transparence de la couche de végétation.
  2. Geoportail : affichage de la carte des sols à partir de coordonnées géographiques.

Le script utilise des coordonnées hardcodées pour les workflows web.
"""

import sys
import time
import math
import re
import gc

import openpyxl # Import conservé mais non utilisé directement pour la lecture des coordonnées
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver import ActionChains
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
import traceback


# ----------------------------------------------------------------------
# (A) PARAMÈTRES GÉNÉRAUX
# ----------------------------------------------------------------------

# Chemin vers le fichier Excel et emplacement des données (non utilisé pour les coordonnées hardcodées)
EXCEL_PATH = r"G:\Mon Drive\1 - Bota & Travail\+++++++++  BOTA  +++++++++\---------------------- 3) BDD\TOOL Excel.xlsm"
SHEET_NAME = "0  PYTHON"
CELL_COORDS = "H5"

# Paramètres pour ArcGIS
SCALE_MIN = "1:100"
TRANSPARENCY = 0.50  # 50 %
DEFAULT_WAIT_TIME = 15 # Temps d'attente par défaut pour WebDriverWait


# ----------------------------------------------------------------------
# (B) FONCTIONS UTILITAIRES
# ----------------------------------------------------------------------

def dms_to_decimal(dms: str) -> float:
    """
    Convertit une coordonnée DMS (e.g. 45°01'25.4"N) en degrés décimaux.
    """
    # Remplace les espaces insécables (U+00A0) par des espaces standards (U+0020)
    dms = dms.replace('\u00A0', ' ')
    match = re.match(r'(\d+)°(\d+)\'([\d.]+)"?([NSEW])', dms.strip())
    if not match:
        raise ValueError(f"Format de coordonnées DMS invalide : {dms}")
    
    degrees, minutes, seconds, hemisphere = match.groups()
    decimal_degrees = float(degrees) + float(minutes) / 60 + float(seconds) / 3600
    
    if hemisphere in "SW":
        return -decimal_degrees
    return decimal_degrees


def latlon_to_webmercator(lat: float, lon: float) -> tuple[float, float]:
    """
    Convertit les coordonnées de degrés décimaux vers WebMercator (EPSG:3857).
    """
    R = 6_378_137.0  # Rayon de la Terre
    x = R * math.radians(lon)
    y = R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def read_coords_from_excel(path: str, sheet: str, cell: str) -> tuple[float, float]:
    """
    Lit une cellule Excel contenant des coordonnées DMS (latitude et longitude séparées
    par un espace), les convertit et les retourne en degrés décimaux.
    Cette fonction n'est plus appelée dans main() si les coordonnées sont hardcodées.
    """
    wb = None
    try:
        wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
        ws = wb[sheet]
        
        raw_coords = ws[cell].value
        if not raw_coords:
            sys.exit(f"[ABORT] La cellule de coordonnées {cell} est vide.")
        
        # Nettoyage et validation du format
        raw_coords_str = str(raw_coords).strip().replace('\u00A0', ' ')
        if ' ' not in raw_coords_str:
            sys.exit(
                f"[ABORT] Format de coordonnées invalide dans la cellule {cell}. "
                f"Attendu : 'Lat Lon' (ex: 45°01'25.4\"N 5°43'27.3\"E). "
                f"Trouvé : '{raw_coords_str}'"
            )

        lat_dms, lon_dms = raw_coords_str.split(maxsplit=1)
        lat_decimal = dms_to_decimal(lat_dms)
        lon_decimal = dms_to_decimal(lon_dms)
        
        return lat_decimal, lon_decimal

    except FileNotFoundError:
        sys.exit(f"[ABORT] Fichier Excel introuvable : {path}")
    except KeyError:
        sys.exit(f"[ABORT] Feuille Excel '{sheet}' introuvable dans {path}")
    except ValueError as ve:
        sys.exit(f"[ABORT] Erreur de formatage des coordonnées DMS dans la cellule {cell} : {ve}")
    except Exception as e:
        sys.exit(f"[ABORT] Erreur inattendue lors de la lecture du fichier Excel : {e}")
    finally:
        if wb:
            wb.close()


# ----------------------------------------------------------------------
# (C) WORKFLOWS SELENIUM
# ----------------------------------------------------------------------

def workflow_arcgis(driver: webdriver.Chrome, lat: float, lon: float) -> None:
    """
    Automatise l'ouverture et la configuration de la carte de la végétation
    sur ArcGIS WebAppViewer.
    """
    print("\n--- Début Workflow ArcGIS ---")
    x, y = latlon_to_webmercator(lat, lon)
    buffer = 1_000
    url = (
        "https://www.arcgis.com/apps/webappviewer/index.html?"
        "id=bece6e542e4c42e0ba9374529c7de44c"
        f"&extent={x-buffer},{y-buffer},{x+buffer},{y+buffer},102100"
    )
    
    wait = WebDriverWait(driver, DEFAULT_WAIT_TIME)
    act = ActionChains(driver)

    driver.get(url)
    
    # Accepter le splash-screen
    try:
        wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[normalize-space()='OK']")
        )).click()
    except TimeoutException:
        print("[INFO] Splash-screen non détecté, continuation du script.")

    # LA SECTION DE DÉZOOM A ÉTÉ SUPPRIMÉE ICI POUR OPTIMISER LA VITESSE
    # et éviter les avertissements "Bouton de dézoom introuvable."
    # Si un dézoom est nécessaire ultérieurement, une solution plus robuste sera à considérer.

    # Ouvrir la liste des couches
    wait.until(EC.element_to_be_clickable(
        (By.XPATH, "//div[@title='Liste des couches']")
    )).click()
    
    # Cliquer sur le menu '...' de la couche de végétation
    dots_css = (
        "#dijit__TemplatedMixin_2 "
        "> table > tbody > tr.layer-tr-node-Carte_de_la_végétation_9780 "
        "> td.col.col3 > div"
    )
    dots_menu = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, dots_css)))
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", dots_menu)
    act.move_to_element(dots_menu).click().perform()

    # Définir la plage de visibilité
    wait.until(EC.element_to_be_clickable(
        (By.XPATH, "//div[normalize-space()='Définir la plage de visibilité']")
    )).click()
    
    arrow_button_xpath = (
        "(//div[contains(@class,'VisibleScaleRangeSlider')]//span[contains(@class,'dijitArrowButtonInner')])[last()]"
    )
    wait.until(EC.element_to_be_clickable((By.XPATH, arrow_button_xpath))).click()

    textbox_xpath = "//input[contains(@class,'dijitInputInner') and @type='text' and @aria-label]"
    textbox = wait.until(EC.visibility_of_element_located((By.XPATH, textbox_xpath)))
    textbox.send_keys(Keys.CONTROL, "a")
    textbox.send_keys(Keys.DELETE)
    textbox.send_keys(SCALE_MIN, Keys.ENTER)
    
    # Attendre que la valeur soit potentiellement appliquée ou que l'élément soit stable
    wait.until(EC.text_to_be_present_in_element_value((By.XPATH, textbox_xpath), SCALE_MIN))
    print(f"[OK] Plage de visibilité minimale définie à {SCALE_MIN}.")

    # Régler la transparence
    try:
        transparency_button = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//div[@itemid='transparency']")
        ))
    except TimeoutException:
        # Si le menu s'est refermé, le rouvrir
        act.move_to_element(dots_menu).click().perform()
        transparency_button = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//div[@itemid='transparency']")
        ))
    
    transparency_button.click()
    slider = wait.until(EC.visibility_of_element_located(
        (By.XPATH, "//div[contains(@class,'dijitSliderBarContainerH')]")
    ))
    # Un clic simple sur le slider positionne la valeur près de 50%
    act.move_to_element(slider).click().perform()
    
    # Validation visuelle ou attente que la valeur soit prise en compte si possible,
    # sinon un bref time.sleep peut être toléré ici si l'interface le requiert
    time.sleep(0.3) 
    print(f"[OK] Transparence réglée autour de {TRANSPARENCY*100:.0f}%.")

    # Fermer la fenêtre des couches
    try:
        wait.until(EC.element_to_be_clickable(
            (By.CSS_SELECTOR, "div.close-btn.jimu-float-trailing")
        )).click()
        print("[OK] Panneau des couches fermé.")
    except TimeoutException:
        print("[WARN] Bouton de fermeture du panneau introuvable.")
    print("--- Fin Workflow ArcGIS ---")


def workflow_geoportail(driver: webdriver.Chrome, lat: float, lon: float) -> None:
    """
    Automatise la recherche par coordonnées sur la carte des sols de Geoportail.
    """
    print("\n--- Début Workflow Geoportail ---")
    wait = WebDriverWait(driver, DEFAULT_WAIT_TIME)
    driver.get("https://www.geoportail.gouv.fr/donnees/carte-des-sols")

    # Attendre que la carte soit visible pour s'assurer que la page est chargée
    wait.until(EC.presence_of_element_located((By.CLASS_NAME, "ol-viewport")))

    # Ouvrir la recherche avancée
    wait.until(EC.element_to_be_clickable(
        (By.CSS_SELECTOR, "#header-search-submit")
    )).click()
    
    # Sélectionner la recherche par "Coordonnées"
    select_element = wait.until(EC.element_to_be_clickable(
        (By.XPATH, "//div[contains(@class,'advanced-search')]//select[1]")
    ))
    Select(select_element).select_by_visible_text("Coordonnées")

    # Saisir la latitude et la longitude
    wait.until(EC.element_to_be_clickable(
        (By.ID, "advanced-search-coords-inputDecLat"))
    ).send_keys(str(lat))
    
    wait.until(EC.element_to_be_clickable(
        (By.ID, "advanced-search-coords-inputDecLon"))
    ).send_keys(str(lon))

    # Valider la recherche
    wait.until(EC.element_to_be_clickable(
        (By.ID, "advanced-search-coords-submit")
    )).click()
    
    # Attendre que la carte se centre sur les nouvelles coordonnées
    wait.until(EC.url_changes(driver.current_url)) 
    
    # Fermer les panneaux superflus (recherche et information)
    for selector in ["#advanced-search-close", "#GPlayerInfoClose"]:
        try:
            short_wait = WebDriverWait(driver, 3) 
            short_wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector))).click()
            short_wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, selector)))
        except TimeoutException:
            pass 

    # Dézoomer 2 fois
    try:
        zoom_out_button = wait.until(EC.element_to_be_clickable((By.ID, "zoom-out")))
        for _ in range(2):
            zoom_out_button.click()
            time.sleep(0.1) 
        print("[OK] Dézoom ×2 effectué.")
    except TimeoutException:
        print("[WARN] Bouton de dézoom de Geoportail introuvable.")
    print("--- Fin Workflow Geoportail ---")


# ----------------------------------------------------------------------
# (D) FONCTION PRINCIPALE
# ----------------------------------------------------------------------

def main():
    """
    Orchestre l'exécution des workflows Selenium.
    """
    # Coordonnées hardcodées directement dans le script
    lat = 44.334500
    lon = 5.781500
    print(f"[INFO] Données ciblées hardcodées : Lat={lat:.6f}, Lon={lon:.6f}")

    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
    driver = None

    try:
        driver = webdriver.Chrome(options=options)

        # Premier onglet pour ArcGIS
        workflow_arcgis(driver, lat, lon)

        # Nouvel onglet pour Geoportail
        driver.switch_to.new_window('tab')
        workflow_geoportail(driver, lat, lon)

        print("\nScript terminé. Les onglets sont prêts.")
        input("Appuyez sur Entrée pour fermer le navigateur…")

    except WebDriverException as we:
        print(f"\n--- ERREUR NAVIGATEUR ---")
        print(f"Une erreur liée au navigateur est survenue : {we}")
        traceback.print_exc()
        input("Appuyez sur Entrée pour tenter de fermer le navigateur...")
    except Exception as e:
        print("\n--- ERREUR CRITIQUE ---")
        traceback.print_exc()
        input("Une erreur est survenue. Appuyez sur Entrée pour tenter de fermer le navigateur...")
    finally:
        if driver:
            driver.quit()
            print("\nNavigateur fermé.")
        gc.collect()


if __name__ == "__main__":
    main()