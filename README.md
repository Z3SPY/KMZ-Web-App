# KMZ-Web-App


//
# list layers (you already did this)
ogrinfo -so "/vsizip//app/JED-HADA-FDH04_HADA FDH-4.kmz/doc.kml"

# extract JUST the layer named `4-1.kmz` to GeoJSON (stream to stdout)
ogr2ogr -f GeoJSON /vsistdout/ \
  "/vsizip//app/JED-HADA-FDH04_HADA FDH-4.kmz/doc.kml" \
  "4-1.kmz"
//