#!/usr/bin/env python3
from pathlib import Path
import argparse
from keybuilder import parse_ocr_file, save_key, generate_html


def main():
    parser = argparse.ArgumentParser(description="Génère une clé dichotomique depuis un OCR")
    parser.add_argument("genre", nargs="?", help="Nom du genre")
    args = parser.parse_args()
    genre = args.genre or input("Nom du genre : ").strip()
    ocr_path = Path("data/ocr") / f"{genre}_ocr.txt"
    if not ocr_path.exists():
        print(f"Fichier {ocr_path} introuvable.")
        return
    nodes = parse_ocr_file(ocr_path)
    outdir = Path("data/keys")
    json_file = save_key(genre, nodes, outdir)
    html_file = generate_html(genre, nodes, outdir)
    print(f"Clé enregistrée : {json_file}")
    print(f"Interface : {html_file}")


if __name__ == "__main__":
    main()
