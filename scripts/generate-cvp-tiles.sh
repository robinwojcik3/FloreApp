#!/usr/bin/env bash
# Utilitaire pour générer des tuiles à partir de la Carte de la Végétation Potentielle
# Requires GDAL (gdalwarp, gdal2tiles.py) and/or tippecanoe for vector tiles.
# Usage (raster) : ./scripts/generate-cvp-tiles.sh path/to/cvp.gpkg
# Les tuiles sont écrites dans ./tiles pour déploiement Netlify.
set -e

SRC="$1"
if [ -z "$SRC" ]; then
  echo "Usage: $0 path/to/cvp.gpkg" >&2
  exit 1
fi

DST="cvp_3857.tif"
ZOOM="3-10"

# Reprojection vers Web Mercator
echo "Reprojection vers EPSG:3857..."
gdalwarp -t_srs EPSG:3857 "$SRC" "$DST"

# Génération des tuiles raster
mkdir -p tiles
echo "Génération des tuiles raster..."
gdal2tiles.py -z $ZOOM -w leaflet "$DST" tiles

echo "Tuiles disponibles dans tiles/"
