

curl "https://places.googleapis.com/v1/places:searchText" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: AIzaSyBiZULTVO4zKzcVTVmYtT04r05R-EzrYe0" \
  -d '{
    "textQuery": "CNC machine shop in Texas"
  }'


curl -X POST "https://places.googleapis.com/v1/places:searchText" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: AIzaSyBiZULTVO4zKzcVTVmYtT04r05R-EzrYe0" \
  -H "X-Goog-FieldMask: places.displayName,places.formattedAddress,places.id,places.primaryType,places.location,places.websiteUri,places.nationalPhoneNumber" \
  -d '{
    "textQuery": "CNC machine shop in Texas"
  }'
